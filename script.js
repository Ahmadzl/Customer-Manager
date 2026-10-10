
"use strict";

// ==========================================
// 1. SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL =
    "https://sxbkjoxmujohptobmqwz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_ffkDrUOb1jg09hzn4Bp0Nw_siCRHeYF";

const APP_USERNAME = "Admin";
const APP_PASSWORD = "Venture.321";
const SESSION_KEY = "customer_manager_logged_in";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// ==========================================
// 2. APPLICATION STATE
// ==========================================

let customers = [];
let selectedCustomerId = null;
let customerItems = [];
let editingCustomerId = null;
let editingItemId = null;

// ==========================================
// 3. DOM ELEMENTS
// ==========================================

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

const customerCount = document.getElementById("customerCount");
const notice = document.getElementById("notice");
const searchInput = document.getElementById("searchInput");
const customerList = document.getElementById("customerList");

const emptySelection = document.getElementById("emptySelection");
const customerDetails = document.getElementById("customerDetails");

const profileName = document.getElementById("profileName");
const profileNumber = document.getElementById("profileNumber");
const customerAvatar = document.getElementById("customerAvatar");
const infoName = document.getElementById("infoName");
const infoNumber = document.getElementById("infoNumber");
const itemsList = document.getElementById("itemsList");

const customerDialog = document.getElementById("customerDialog");
const customerForm = document.getElementById("customerForm");
const customerDialogTitle = document.getElementById("customerDialogTitle");
const customerNameInput = document.getElementById("customerNameInput");
const customerNumberInput = document.getElementById("customerNumberInput");
const customerFormError = document.getElementById("customerFormError");
const saveCustomerBtn = document.getElementById("saveCustomerBtn");

const itemDialog = document.getElementById("itemDialog");
const itemForm = document.getElementById("itemForm");
const itemDialogTitle = document.getElementById("itemDialogTitle");
const itemTypeInput = document.getElementById("itemTypeInput");
const itemTextInput = document.getElementById("itemTextInput");
const itemFormError = document.getElementById("itemFormError");
const saveItemBtn = document.getElementById("saveItemBtn");

// ==========================================
// 4. GENERAL HELPERS
// ==========================================

function showNotice(message, type = "success") {
    notice.textContent = message;
    notice.className = `notice ${type}`;
}

function hideNotice() {
    notice.textContent = "";
    notice.className = "notice hidden";
}

function setError(element, message = "") {
    element.textContent = message;
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

function getInitial(name) {
    return (name || "C").trim().charAt(0).toUpperCase() || "C";
}

function getErrorMessage(error) {
    if (!error) {
        return "An unexpected error occurred.";
    }

    if (error.code === "23505") {
        return "This customer number already exists. Please use a different number.";
    }

    if (error.code === "23503") {
        return "This record is linked to other information and could not be changed.";
    }

    if (error.code === "23514") {
        return "The information does not match the database rules. Please check the item type and content.";
    }

    if (error.code === "42501" || error.code === "PGRST301") {
        return "Database access was denied. Check your Supabase permissions and RLS policies.";
    }

    return error.message || "An unexpected error occurred. Please try again.";
}

function setButtonLoading(button, loading, normalText) {
    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : normalText;
}

// ==========================================
// 5. LOGIN AND LOGOUT
// ==========================================

function showLogin() {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
}

function showApplication() {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
}

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (username !== APP_USERNAME || password !== APP_PASSWORD) {
        setError(loginError, "Incorrect username or password.");
        passwordInput.select();
        return;
    }

    sessionStorage.setItem(SESSION_KEY, "true");
    setError(loginError);
    passwordInput.value = "";

    showApplication();
    hideNotice();

    try {
        await loadCustomers();
    } catch (error) {
        showNotice(
            "Could not load customers: " + getErrorMessage(error),
            "error"
        );
    }
});

logoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem(SESSION_KEY);

    customers = [];
    customerItems = [];
    selectedCustomerId = null;

    customerList.replaceChildren();
    itemsList.replaceChildren();

    showLogin();
    hideNotice();
    loginForm.reset();
});

// ==========================================
// 6. LOAD AND DISPLAY CUSTOMERS
// ==========================================

async function loadCustomers() {
    customerList.replaceChildren();

    const loading = document.createElement("p");
    loading.className = "muted loading-text";
    loading.textContent = "Loading customers...";
    customerList.appendChild(loading);

    const { data, error } = await db
        .from("customers")
        .select("id, customer_number, customer_name, created_at, updated_at")
        .order("customer_name", { ascending: true });

    if (error) throw error;

    customers = data || [];
    customerCount.textContent = String(customers.length);

    renderCustomerList();

    if (selectedCustomerId) {
        const exists = customers.some(
            customer => customer.id === selectedCustomerId
        );

        if (exists) {
            await selectCustomer(selectedCustomerId);
            return;
        }
    }

    if (customers.length > 0) {
        await selectCustomer(customers[0].id);
    } else {
        selectedCustomerId = null;
        customerItems = [];
        customerDetails.classList.add("hidden");
        emptySelection.classList.remove("hidden");
        itemsList.replaceChildren();
    }
}

function renderCustomerList() {
    customerList.replaceChildren();

    const searchTerm = searchInput.value.trim().toLowerCase();

    const filtered = customers.filter(customer => {
        const name = (customer.customer_name || "").toLowerCase();
        const number = (customer.customer_number || "").toLowerCase();

        return name.includes(searchTerm) || number.includes(searchTerm);
    });

    if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.className = "muted list-empty";
        empty.textContent = searchTerm
            ? "No customers match your search."
            : "No customers added yet.";

        customerList.appendChild(empty);
        return;
    }

    filtered.forEach(customer => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "customer-entry";

        if (customer.id === selectedCustomerId) {
            button.classList.add("active");
        }

        const avatar = document.createElement("span");
        avatar.className = "customer-mini-avatar";
        avatar.textContent = getInitial(customer.customer_name);

        const textContainer = document.createElement("span");
        textContainer.className = "customer-entry-text";

        const name = document.createElement("strong");
        name.textContent = customer.customer_name;

        const number = document.createElement("span");
        number.textContent = customer.customer_number;

        textContainer.append(name, number);
        button.append(avatar, textContainer);

        button.addEventListener("click", async function () {
            hideNotice();

            try {
                await selectCustomer(customer.id);
            } catch (error) {
                showNotice(
                    "Could not load customer information: " +
                    getErrorMessage(error),
                    "error"
                );
            }
        });

        customerList.appendChild(button);
    });
}

async function selectCustomer(customerId) {
    const customer = customers.find(item => item.id === customerId);

    if (!customer) {
        selectedCustomerId = null;
        customerItems = [];
        customerDetails.classList.add("hidden");
        emptySelection.classList.remove("hidden");
        return;
    }

    selectedCustomerId = customerId;

    profileName.textContent = customer.customer_name;
    profileNumber.textContent = customer.customer_number;
    infoName.textContent = customer.customer_name;
    infoNumber.textContent = customer.customer_number;
    customerAvatar.textContent = getInitial(customer.customer_name);

    emptySelection.classList.add("hidden");
    customerDetails.classList.remove("hidden");

    renderCustomerList();
    await loadItems(customerId);
}

// ==========================================
// 7. ADD AND EDIT CUSTOMERS
// ==========================================

function openCustomerDialog(customer = null) {
    editingCustomerId = customer ? customer.id : null;

    customerForm.reset();
    setError(customerFormError);

    customerDialogTitle.textContent = customer
        ? "Edit Customer"
        : "Add Customer";

    saveCustomerBtn.textContent = customer
        ? "Save Changes"
        : "Save Customer";

    customerNameInput.value = customer ? customer.customer_name : "";
    customerNumberInput.value = customer ? customer.customer_number : "";

    customerDialog.showModal();
    customerNameInput.focus();
}

function closeCustomerDialog() {
    if (customerDialog.open) customerDialog.close();

    customerForm.reset();
    setError(customerFormError);
    editingCustomerId = null;
}

document.getElementById("addCustomerBtn").addEventListener("click", function () {
    openCustomerDialog();
});

document.getElementById("emptyAddCustomerBtn").addEventListener("click", function () {
    openCustomerDialog();
});

document.getElementById("editCustomerBtn").addEventListener("click", function () {
    const customer = customers.find(item => item.id === selectedCustomerId);

    if (customer) openCustomerDialog(customer);
});

document.getElementById("closeCustomerDialog")
    .addEventListener("click", closeCustomerDialog);

document.getElementById("cancelCustomerBtn")
    .addEventListener("click", closeCustomerDialog);

customerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const customerName = customerNameInput.value.trim();
    const customerNumber = customerNumberInput.value.trim();

    if (!customerName || !customerNumber) {
        setError(customerFormError, "Please complete all required fields.");
        return;
    }

    const wasEditing = Boolean(editingCustomerId);
    const originalText = wasEditing ? "Save Changes" : "Save Customer";

    setButtonLoading(saveCustomerBtn, true, originalText);
    setError(customerFormError);

    try {
        let result;

        if (wasEditing) {
            result = await db
                .from("customers")
                .update({
                    customer_name: customerName,
                    customer_number: customerNumber,
                    updated_at: new Date().toISOString()
                })
                .eq("id", editingCustomerId)
                .select("id")
                .maybeSingle();
        } else {
            result = await db
                .from("customers")
                .insert({
                    id: crypto.randomUUID(),
                    customer_name: customerName,
                    customer_number: customerNumber,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select("id")
                .single();
        }

        if (result.error) throw result.error;

        if (!result.data) {
            throw new Error(
                "No customer was saved. Check your database permissions."
            );
        }

        selectedCustomerId = result.data.id;

        closeCustomerDialog();
        await loadCustomers();

        showNotice(
            wasEditing
                ? "Customer updated successfully."
                : "Customer added successfully.",
            "success"
        );
    } catch (error) {
        setError(customerFormError, getErrorMessage(error));
    } finally {
        setButtonLoading(saveCustomerBtn, false, originalText);
    }
});

// ==========================================
// 8. DELETE CUSTOMERS
// ==========================================

document.getElementById("deleteCustomerBtn").addEventListener("click", async function () {
    const customer = customers.find(item => item.id === selectedCustomerId);

    if (!customer) return;

    const confirmed = window.confirm(
        `Are you sure you want to delete "${customer.customer_name}"?\n\n` +
        "All notes belonging to this customer will also be deleted."
    );

    if (!confirmed) return;

    const button = document.getElementById("deleteCustomerBtn");
    button.disabled = true;

    try {
        const { error: itemsError } = await db
            .from("customer_items")
            .delete()
            .eq("customer_id", customer.id);

        if (itemsError) throw itemsError;

        const { data, error } = await db
            .from("customers")
            .delete()
            .eq("id", customer.id)
            .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error(
                "The customer was not deleted. Check your database permissions."
            );
        }

        selectedCustomerId = null;
        customerItems = [];

        await loadCustomers();
        showNotice("Customer deleted successfully.", "success");
    } catch (error) {
        showNotice(
            "Could not delete customer: " + getErrorMessage(error),
            "error"
        );
    } finally {
        button.disabled = false;
    }
});

// ==========================================
// 9. LOAD AND DISPLAY CUSTOMER NOTES
// ==========================================

async function loadItems(customerId) {
    itemsList.replaceChildren();

    const loading = document.createElement("p");
    loading.className = "muted";
    loading.textContent = "Loading information...";
    itemsList.appendChild(loading);

    const { data, error } = await db
        .from("customer_items")
        .select(
            "id, customer_id, type, text, file_path, original_file_name, sort_order, created_at"
        )
        .eq("customer_id", customerId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

    if (error) throw error;

    customerItems = data || [];
    renderItems();
}

function renderItems() {
    itemsList.replaceChildren();

    if (customerItems.length === 0) {
        const empty = document.createElement("p");
        empty.className = "muted list-empty";
        empty.textContent =
            "No notes or information have been added for this customer yet.";

        itemsList.appendChild(empty);
        return;
    }

    customerItems.forEach(item => {
        const card = document.createElement("article");
        card.className = "item-card";

        const header = document.createElement("div");
        header.className = "item-card-header";

        const type = document.createElement("span");
        type.className = "item-type";
        type.textContent = item.type || "Text";

        const date = document.createElement("span");
        date.className = "item-date";
        date.textContent = formatDate(item.created_at);

        header.append(type, date);

        const text = document.createElement("p");
        text.className = "item-text";
        text.textContent = item.text || "";

        card.append(header, text);

        const actions = document.createElement("div");
        actions.className = "item-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "small-button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", function () {
            openItemDialog(item);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "small-button delete";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function () {
            deleteItem(item);
        });

        actions.append(editButton, deleteButton);
        card.appendChild(actions);
        itemsList.appendChild(card);
    });
}

// ==========================================
// 10. ADD AND EDIT NOTES
// ==========================================

function openItemDialog(item = null) {
    if (!selectedCustomerId) {
        showNotice("Please select a customer first.", "error");
        return;
    }

    editingItemId = item ? item.id : null;

    itemForm.reset();
    setError(itemFormError);

    itemDialogTitle.textContent = item ? "Edit Information" : "Add Note";
    saveItemBtn.textContent = item ? "Save Changes" : "Save Information";

    // The existing database constraint accepts "Text" for text notes.
    itemTypeInput.value = "Text";
    itemTextInput.value = item ? (item.text || "") : "";

    itemDialog.showModal();
    itemTextInput.focus();
}

function closeItemDialog() {
    if (itemDialog.open) itemDialog.close();

    itemForm.reset();
    setError(itemFormError);
    editingItemId = null;
}

document.getElementById("addItemBtn").addEventListener("click", function () {
    openItemDialog();
});

document.getElementById("closeItemDialog")
    .addEventListener("click", closeItemDialog);

document.getElementById("cancelItemBtn")
    .addEventListener("click", closeItemDialog);

itemForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!selectedCustomerId) {
        setError(itemFormError, "Please select a customer first.");
        return;
    }

    const itemText = itemTextInput.value.trim();

    if (!itemText) {
        setError(itemFormError, "Please enter the details.");
        return;
    }

    const wasEditing = Boolean(editingItemId);
    const originalText = wasEditing ? "Save Changes" : "Save Information";

    setButtonLoading(saveItemBtn, true, originalText);
    setError(itemFormError);

    try {
        let result;

        if (wasEditing) {
            // Keep the existing record as a text item.
            result = await db
                .from("customer_items")
                .update({
                    type: "Text",
                    text: itemText,
                    file_path: null
                })
                .eq("id", editingItemId)
                .eq("customer_id", selectedCustomerId)
                .select("id")
                .maybeSingle();
        } else {
            const nextOrder = customerItems.length > 0
                ? Math.max(
                    ...customerItems.map(
                        item => Number(item.sort_order) || 0
                    )
                ) + 1
                : 1;

            // Important: type must be "Text", not "Note" or "Task".
            // The current database constraint requires text NOT NULL
            // and file_path NULL for a Text item.
            result = await db
                .from("customer_items")
                .insert({
                    id: crypto.randomUUID(),
                    customer_id: selectedCustomerId,
                    type: "Text",
                    text: itemText,
                    file_path: null,
                    original_file_name: null,
                    sort_order: nextOrder,
                    created_at: new Date().toISOString()
                })
                .select("id")
                .single();
        }

        if (result.error) throw result.error;

        if (!result.data) {
            throw new Error(
                "The information was not saved. Check your database permissions."
            );
        }

        closeItemDialog();
        await loadItems(selectedCustomerId);

        showNotice(
            wasEditing
                ? "Information updated successfully."
                : "Information added successfully.",
            "success"
        );
    } catch (error) {
        setError(itemFormError, getErrorMessage(error));
    } finally {
        setButtonLoading(saveItemBtn, false, originalText);
    }
});

// ==========================================
// 11. DELETE NOTES
// ==========================================

async function deleteItem(item) {
    const confirmed = window.confirm(
        "Are you sure you want to delete this information?"
    );

    if (!confirmed) return;

    try {
        const { data, error } = await db
            .from("customer_items")
            .delete()
            .eq("id", item.id)
            .eq("customer_id", selectedCustomerId)
            .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error(
                "The information was not deleted. Check your database permissions."
            );
        }

        await loadItems(selectedCustomerId);
        showNotice("Information deleted successfully.", "success");
    } catch (error) {
        showNotice(
            "Could not delete information: " + getErrorMessage(error),
            "error"
        );
    }
}

// ==========================================
// 12. SEARCH
// ==========================================

searchInput.addEventListener("input", renderCustomerList);

// ==========================================
// 13. START APPLICATION
// ==========================================

async function startApplication() {
    if (sessionStorage.getItem(SESSION_KEY) !== "true") {
        showLogin();
        return;
    }

    showApplication();

    try {
        await loadCustomers();
    } catch (error) {
        showNotice(
            "Could not load customers: " + getErrorMessage(error),
            "error"
        );
    }
}

startApplication();
