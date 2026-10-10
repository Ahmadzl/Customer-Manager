
const SUPABASE_URL = "https://sxbkjoxmujohptobmqwz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ffkDrUOb1jg09hzn4Bp0Nw_siCRHeYF";

// تسجيل دخول بسيط للواجهة فقط
const APP_USERNAME = "Admin";
const APP_PASSWORD = "Venture.321";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

const state = {
  customers: [],
  selectedCustomer: null,
  items: []
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function initials(name = "") {
  return name.trim().slice(0, 1) || "ز";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ar", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function showNotice(message, type = "success") {
  const notice = $("notice");
  notice.textContent = message;
  notice.className = `notice ${type}`;

  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => {
    notice.classList.add("hidden");
  }, 5000);
}

function showError(id, message = "") {
  $(id).textContent = message;
}

// تسجيل الدخول
$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const username = $("username").value.trim();
  const password = $("password").value;

  if (
    username === APP_USERNAME &&
    password === APP_PASSWORD
  ) {
    sessionStorage.setItem("customerManagerLoggedIn", "yes");
    $("loginError").textContent = "";
    $("password").value = "";
    showApp();
  } else {
    showError(
      "loginError",
      "اسم المستخدم أو كلمة المرور غير صحيحة."
    );
  }
});

$("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("customerManagerLoggedIn");

  state.selectedCustomer = null;
  state.items = [];

  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("customerDetails").classList.add("hidden");
  $("emptySelection").classList.remove("hidden");
});

// عرض التطبيق
function showApp() {
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  loadCustomers();
}

// تحميل الزبائن من قاعدة البيانات
async function loadCustomers(selectId = null) {
  $("customerList").innerHTML =
    '<p class="muted">جارٍ تحميل الزبائن...</p>';

  const { data, error } = await db
    .from("customers")
    .select("id, customer_number, customer_name, created_at, updated_at")
    .order("customer_name", { ascending: true });

  if (error) {
    $("customerList").innerHTML =
      '<p class="muted">تعذّر تحميل الزبائن.</p>';

    showNotice(
      `خطأ في تحميل الزبائن: ${error.message}`,
      "error"
    );

    return;
  }

  state.customers = data || [];
  $("customerCount").textContent = state.customers.length;

  renderCustomers();

  const targetId = selectId || state.selectedCustomer?.id;

  if (targetId) {
    const customer = state.customers.find(
      (c) => c.id === targetId
    );

    if (customer) {
      await selectCustomer(customer);
    } else {
      clearSelection();
    }
  } else if (state.customers.length) {
    await selectCustomer(state.customers[0]);
  } else {
    clearSelection();
  }
}

// عرض قائمة الزبائن والبحث
function renderCustomers() {
  const query = $("searchInput").value
    .trim()
    .toLocaleLowerCase();

  const filtered = state.customers.filter((customer) => {
    const name = String(customer.customer_name || "")
      .toLocaleLowerCase();

    const number = String(customer.customer_number || "")
      .toLocaleLowerCase();

    return name.includes(query) || number.includes(query);
  });

  if (!filtered.length) {
    $("customerList").innerHTML =
      '<p class="muted">لا توجد نتائج مطابقة.</p>';
    return;
  }

  $("customerList").innerHTML = filtered.map((customer) => `
    <button
      class="customer-row ${
        state.selectedCustomer?.id === customer.id ? "active" : ""
      }"
      data-customer-id="${escapeHtml(customer.id)}"
      type="button">

      <span class="mini-avatar">
        ${escapeHtml(initials(customer.customer_name))}
      </span>

      <span class="row-text">
        <strong>${escapeHtml(customer.customer_name)}</strong>
        <small>${escapeHtml(customer.customer_number)}</small>
      </span>

      <span>‹</span>
    </button>
  `).join("");

  document.querySelectorAll("[data-customer-id]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const customer = state.customers.find(
          (c) => c.id === button.dataset.customerId
        );

        if (customer) selectCustomer(customer);
      });
    });
}

// اختيار زبون وعرض ملفه
async function selectCustomer(customer) {
  state.selectedCustomer = customer;

  $("emptySelection").classList.add("hidden");
  $("customerDetails").classList.remove("hidden");

  $("profileName").textContent = customer.customer_name;
  $("profileNumber").textContent = customer.customer_number;
  $("customerAvatar").textContent =
    initials(customer.customer_name);

  renderCustomers();
  await loadItems(customer.id);
}

function clearSelection() {
  state.selectedCustomer = null;
  state.items = [];

  $("customerDetails").classList.add("hidden");
  $("emptySelection").classList.remove("hidden");

  renderCustomers();
}

// تحميل المعلومات الخاصة بزبون
async function loadItems(customerId) {
  $("itemsList").innerHTML =
    '<p class="muted">جارٍ تحميل المعلومات...</p>';

  const { data, error } = await db
    .from("customer_items")
    .select(`
      id,
      customer_id,
      type,
      text,
      file_path,
      original_file_name,
      sort_order,
      created_at
    `)
    .eq("customer_id", customerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    $("itemsList").innerHTML =
      '<p class="muted">تعذّر تحميل المعلومات.</p>';

    showNotice(
      `خطأ في تحميل المعلومات: ${error.message}`,
      "error"
    );

    return;
  }

  state.items = data || [];
  renderItems();
}

// عرض معلومات الزبون
function renderItems() {
  if (!state.items.length) {
    $("itemsList").innerHTML =
      '<p class="muted">لا توجد معلومات بعد. أضف أول معلومة.</p>';
    return;
  }

  $("itemsList").innerHTML = state.items.map((item) => `
    <article class="item-card">
      <div class="item-symbol">▤</div>

      <div class="item-body">
        <h4>${escapeHtml(item.type || "معلومة")}</h4>

        <div class="item-date">
          ${escapeHtml(formatDate(item.created_at))}
        </div>

        ${
          item.text
            ? `<p class="item-text">${escapeHtml(item.text)}</p>`
            : ""
        }

        ${
          item.file_path
            ? `<p class="file-path">مسار الملف: ${escapeHtml(item.file_path)}</p>`
            : ""
        }

        ${
          item.original_file_name
            ? `<p class="item-date">اسم الملف: ${escapeHtml(item.original_file_name)}</p>`
            : ""
        }
      </div>

      <div class="item-actions">
        <button class="mini-btn" data-edit-item="${escapeHtml(item.id)}">
          تعديل
        </button>

        <button class="mini-btn delete" data-delete-item="${escapeHtml(item.id)}">
          حذف
        </button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-edit-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.items.find(
        (i) => i.id === button.dataset.editItem
      );

      if (item) openItemDialog(item);
    });
  });

  document.querySelectorAll("[data-delete-item]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteItem(button.dataset.deleteItem);
    });
  });
}

// إضافة أو تعديل زبون
function openCustomerDialog(customer = null) {
  $("customerForm").reset();
  showError("customerFormError");

  $("customerId").value = customer?.id || "";
  $("customerNumber").value = customer?.customer_number || "";
  $("customerName").value = customer?.customer_name || "";

  $("customerDialogTitle").textContent =
    customer ? "تعديل بيانات الزبون" : "إضافة زبون جديد";

  $("customerDialog").showModal();
}

async function saveCustomer(event) {
  event.preventDefault();
  showError("customerFormError");

  const id = $("customerId").value;
  const customer_number = $("customerNumber").value.trim();
  const customer_name = $("customerName").value.trim();

  if (!customer_number || !customer_name) {
    return showError(
      "customerFormError",
      "يرجى إدخال رقم الزبون واسمه."
    );
  }

  const now = new Date().toISOString();

  let result;

  if (id) {
    result = await db
      .from("customers")
      .update({
        customer_number,
        customer_name,
        updated_at: now
      })
      .eq("id", id)
      .select()
      .single();
  } else {
    result = await db
      .from("customers")
      .insert({
        id: crypto.randomUUID(),
        customer_number,
        customer_name,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
  }

  if (result.error) {
    showError(
      "customerFormError",
      `لم يتم الحفظ: ${result.error.message}`
    );
    return;
  }

  $("customerDialog").close();

  showNotice(id
    ? "تم تحديث بيانات الزبون."
    : "تمت إضافة الزبون بنجاح."
  );

  await loadCustomers(result.data.id);
}

// إضافة أو تعديل معلومة
function openItemDialog(item = null) {
  if (!state.selectedCustomer) {
    showNotice("اختر زبونًا أولًا.", "error");
    return;
  }

  $("itemForm").reset();
  showError("itemFormError");

  $("itemId").value = item?.id || "";
  $("itemType").value = item?.type || "";
  $("itemText").value = item?.text || "";
  $("itemFilePath").value = item?.file_path || "";
  $("itemOriginalFileName").value =
    item?.original_file_name || "";

  $("itemDialogTitle").textContent =
    item ? "تعديل المعلومة" : "إضافة معلومة";

  $("itemDialog").showModal();
}

async function saveItem(event) {
  event.preventDefault();
  showError("itemFormError");

  if (!state.selectedCustomer) {
    return showError("itemFormError", "اختر زبونًا أولًا.");
  }

  const id = $("itemId").value;
  const type = $("itemType").value.trim();

  if (!type) {
    return showError(
      "itemFormError",
      "يرجى إدخال نوع المعلومة."
    );
  }

  const payload = {
    customer_id: state.selectedCustomer.id,
    type,
    text: $("itemText").value.trim() || null,
    file_path: $("itemFilePath").value.trim() || null,
    original_file_name:
      $("itemOriginalFileName").value.trim() || null
  };

  let result;

  if (id) {
    result = await db
      .from("customer_items")
      .update(payload)
      .eq("id", id)
      .eq("customer_id", state.selectedCustomer.id)
      .select()
      .single();
  } else {
    const maxOrder = state.items.reduce(
      (max, item) => Math.max(max, Number(item.sort_order) || 0),
      0
    );

    payload.id = crypto.randomUUID();
    payload.created_at = new Date().toISOString();
    payload.sort_order = maxOrder + 1;

    result = await db
      .from("customer_items")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) {
    showError(
      "itemFormError",
      `لم يتم الحفظ: ${result.error.message}`
    );
    return;
  }

  $("itemDialog").close();

  showNotice(id
    ? "تم تحديث المعلومة."
    : "تمت إضافة المعلومة."
  );

  await loadItems(state.selectedCustomer.id);
}

// حذف معلومة
async function deleteItem(itemId) {
  const item = state.items.find((i) => i.id === itemId);

  if (!item) return;

  if (!confirm(`هل تريد حذف المعلومة «${item.type}»؟`)) {
    return;
  }

  const { error } = await db
    .from("customer_items")
    .delete()
    .eq("id", itemId)
    .eq("customer_id", state.selectedCustomer.id);

  if (error) {
    showNotice(`تعذّر الحذف: ${error.message}`, "error");
    return;
  }

  showNotice("تم حذف المعلومة.");
  await loadItems(state.selectedCustomer.id);
}

// حذف زبون ومعلوماته المرتبطة
async function deleteSelectedCustomer() {
  const customer = state.selectedCustomer;

  if (!customer) return;

  const confirmed = confirm(
    `هل تريد حذف الزبون «${customer.customer_name}» وجميع معلوماته؟ لا يمكن التراجع عن ذلك.`
  );

  if (!confirmed) return;

  const childResult = await db
    .from("customer_items")
    .delete()
    .eq("customer_id", customer.id);

  if (childResult.error) {
    showNotice(
      `تعذّر حذف معلومات الزبون: ${childResult.error.message}`,
      "error"
    );
    return;
  }

  const { error } = await db
    .from("customers")
    .delete()
    .eq("id", customer.id);

  if (error) {
    showNotice(`تعذّر حذف الزبون: ${error.message}`, "error");
    return;
  }

  state.selectedCustomer = null;
  showNotice("تم حذف الزبون ومعلوماته المرتبطة.");
  await loadCustomers();
}

// ربط الأزرار بالنماذج
$("searchInput").addEventListener("input", renderCustomers);

$("newCustomerBtn").addEventListener("click", () => {
  openCustomerDialog();
});

$("emptyNewCustomerBtn").addEventListener("click", () => {
  openCustomerDialog();
});

$("editCustomerBtn").addEventListener("click", () => {
  if (state.selectedCustomer) {
    openCustomerDialog(state.selectedCustomer);
  }
});

$("deleteCustomerBtn").addEventListener(
  "click",
  deleteSelectedCustomer
);

$("addItemBtn").addEventListener("click", () => {
  openItemDialog();
});

$("customerForm").addEventListener("submit", saveCustomer);
$("itemForm").addEventListener("submit", saveItem);

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    $(button.dataset.close).close();
  });
});

// افتح الصفحة بعد تسجيل الدخول في الجلسة الحالية فقط
if (sessionStorage.getItem("customerManagerLoggedIn") === "yes") {
  showApp();
}
