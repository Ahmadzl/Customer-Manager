
"use strict";

/* =========================================
   1. CONFIGURATION
========================================= */

const SUPABASE_URL = "https://sxbkjoxmujohptobmqwz.supabase.co";
const SUPABASE_KEY = "sb_publishable_ffkDrUOb1jg09hzn4Bp0Nw_siCRHeYF";

const APP_USERNAME = "Admin";
const APP_PASSWORD = "Venture.321";
const SESSION_KEY = "customer_manager_logged_in";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* =========================================
   2. APPLICATION STATE
========================================= */

let customers = [];
let selectedCustomerId = null;
let customerItems = [];
let editingCustomerId = null;
let editingItemId = null;
let isLoading = false;

/* =========================================
   3. DOM HELPERS
========================================= */

function $(id) {
    return document.getElementById(id);
}

function showStatus(message, type = "") {
    const element = $("statusMessage");

    if (!element) return;

    element.textContent = message;
    element.className = "status-message";

    if (type) {
        element.classList.add(type);
    }
}

function setError(id, message = "") {
    const element = $(id);

    if (element) {
        element.textContent = message;
    }
}

function setButtonLoading(buttonId, loading, loadingText = "Saving...") {
    const button = $(buttonId);

    if (!button) return;

    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
        button.disabled = true;
    } else {
        button.textContent =
            button.dataset.originalText || button.textContent;
        button.disabled = false;
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    throw new Error(
        "Your browser does not support secure ID generation. Please use an updated browser."
    );
}

function getErrorMessage(error) {
    if (!error) {
        return "An unknown error occurred.";
    }

    const message = error.message || String(error);
    const code = error.code || "";

    if (code === "23505") {
        return "This customer number already exists. Please use a different number.";
    }

    if (code === "23503") {
        return "The related customer record could not be found.";
    }

    if (code === "23514") {
        return "The data does not match the database rules. Please check the note information.";
    }

    if (code === "42501" || code === "PGRST301") {
        return "Access denied. Check your Supabase Row Level Security policies.";
    }

    if (
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("network")
    ) {
        return "Could not connect to Supabase. Check your internet connection and project settings.";
    }

    return message;
}

/* =========================================
   4. LOGIN AND LOGOUT
========================================= */

function showApplication() {
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
}

function showLogin() {
    $("appView").classList.add("hidden");
    $("loginView").classList.remove("hidden");
}

async function handleLogin(event) {
    event.preventDefault();

    const username = $("username").value.trim();
    const password = $("password").value;

    setError("loginError", "");

    if (username === APP_USERNAME && password === APP_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, "true");

        showApplication();
        $("password").value = "";

        await loadCustomers();
    } else {
        setError("loginError", "Incorrect username or password.");
        $("password").value = "";
        $("password").focus();
    }
}

function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);

    selectedCustomerId = null;
    customers = [];
    customerItems = [];

    $("loginForm").reset();

    showLogin();
    setError("loginError", "");
}

/* =========================================
   5. LOAD CUSTOMERS
========================================= */

async function loadCustomers() {
    if (isLoading) return;

    isLoading = true;
    showStatus("Loading customers...");

    try {
        const { data, error } = await supabaseClient
            .from("customers")
            .select("*")
            .order("customer_name", { ascending: true });

        if (error) throw error;

        customers = data || [];

        if (
            selectedCustomerId &&
            !customers.some(customer => customer.id === selectedCustomerId)
        ) {
            selectedCustomerId = null;
        }

        renderCustomers();

        if (selectedCustomerId) {
            await selectCustomer(selectedCustomerId);
        } else if (customers.length > 0) {
            await selectCustomer(customers[0].id);
        } else {
            renderEmptyDetails();
        }

        showStatus(
            `Loaded ${customers.length} customer(s).`,
            "success"
        );
    } catch (error) {
        console.error("Load customers error:", error);
        showStatus(getErrorMessage(error), "error");
        renderCustomers();
    } finally {
        isLoading = false;
    }
}

function getFilteredCustomers() {
    const query = $("customerSearch").value.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter(customer =>
        String(customer.customer_number || "").toLowerCase().includes(query) ||
        String(customer.customer_name || "").toLowerCase().includes(query)
    );
}

function renderCustomers() {
    const list = $("customerList");
    const filteredCustomers = getFilteredCustomers();

    $("customerCount").textContent = String(customers.length);

    if (filteredCustomers.length === 0) {
        list.innerHTML = `
            <p class="empty-state">
                ${customers.length === 0
                    ? "No customers found. Add your first customer."
                    : "No customers match your search."}
            </p>
        `;
        return;
    }

    list.innerHTML = filteredCustomers.map(customer => `
        <button
            type="button"
            class="customer-entry ${
                customer.id === selectedCustomerId ? "active" : ""
            }"
            data-customer-id="${escapeHtml(customer.id)}"
        >
            <strong>${escapeHtml(customer.customer_name)}</strong>
            <span>Customer #${escapeHtml(customer.customer_number)}</span>
        </button>
    `).join("");
}

/* =========================================
   6. CUSTOMER DETAILS AND NOTES
========================================= */

function renderEmptyDetails() {
    $("customerDetails").classList.add("hidden");
    $("emptyDetails").classList.remove("hidden");

    $("notesList").innerHTML =
        '<p class="empty-state">Select a customer to view notes.</p>';
}

async function selectCustomer(customerId) {
    const customer = customers.find(item => item.id === customerId);

    if (!customer) {
        selectedCustomerId = null;
        renderEmptyDetails();
        renderCustomers();
        return;
    }

    selectedCustomerId = customerId;

    renderCustomers();

    $("emptyDetails").classList.add("hidden");
    $("customerDetails").classList.remove("hidden");

    $("detailCustomerName").textContent = customer.customer_name;
    $("detailCustomerNumber").textContent =
        `Customer #${customer.customer_number}`;
    $("detailNumberValue").textContent = customer.customer_number;
    $("detailCreatedAt").textContent = formatDate(customer.created_at);

    await loadCustomerItems(customerId);
}

async function loadCustomerItems(customerId) {
    $("notesList").innerHTML =
        '<p class="empty-state">Loading notes...</p>';

    try {
        const { data, error } = await supabaseClient
            .from("customer_items")
            .select("*")
            .eq("customer_id", customerId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });

        if (error) throw error;

        customerItems = data || [];
        renderItems();
    } catch (error) {
        console.error("Load notes error:", error);

        $("notesList").innerHTML = `
            <p class="empty-state">
                ${escapeHtml(getErrorMessage(error))}
            </p>
        `;
    }
}

/* =========================================
   7. SAFE RICH TEXT NOTES
========================================= */

function sanitizeNoteHtml(html) {
    if (!window.DOMPurify) {
        throw new Error(
            "The text editor security library did not load. Refresh the page and try again."
        );
    }

    return window.DOMPurify.sanitize(String(html ?? ""), {
        ALLOWED_TAGS: [
            "p", "br", "div", "span",
            "b", "strong", "i", "em", "u",
            "ol", "ul", "li",
            "h1", "h2", "h3",
            "font"
        ],
        ALLOWED_ATTR: ["style", "size"],
        ALLOW_DATA_ATTR: false
    });
}

function looksLikeHtml(value) {
    return /<\/?[a-z][\s\S]*?>/i.test(String(value ?? ""));
}

function getSafeNoteHtml(value) {
    const text = String(value ?? "");

    if (looksLikeHtml(text)) {
        return sanitizeNoteHtml(text);
    }

    return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

function renderItems() {
    const list = $("notesList");

    if (!customerItems.length) {
        list.innerHTML = `
            <p class="empty-state">
                No notes yet. Click "Add Note" to create one.
            </p>
        `;
        return;
    }

    list.innerHTML = customerItems.map(item => `
        <article class="note-card">
            <div class="note-card-header">
                <span class="note-date">
                    ${escapeHtml(formatDate(item.created_at))}
                </span>

                <div class="note-actions">
                    <button
                        type="button"
                        class="secondary-button"
                        data-edit-item="${escapeHtml(item.id)}"
                    >Edit</button>

                    <button
                        type="button"
                        class="danger-button"
                        data-delete-item="${escapeHtml(item.id)}"
                    >Delete</button>
                </div>
            </div>

            <div class="note-content">
                ${getSafeNoteHtml(item.text)}
            </div>
        </article>
    `).join("");
}

/* =========================================
   8. ADD AND EDIT CUSTOMER
========================================= */

function openCustomerDialog(customer = null) {
    editingCustomerId = customer ? customer.id : null;

    $("customerForm").reset();
    setError("customerFormError", "");

    $("customerDialogTitle").textContent =
        customer ? "Edit Customer" : "Add Customer";

    $("saveCustomerButton").textContent =
        customer ? "Save Changes" : "Save Customer";

    $("customerNumberInput").value =
        customer ? customer.customer_number : "";

    $("customerNameInput").value =
        customer ? customer.customer_name : "";

    $("customerDialog").showModal();
    $("customerNumberInput").focus();
}

async function handleCustomerSave(event) {
    event.preventDefault();

    const customerNumber = $("customerNumberInput").value.trim();
    const customerName = $("customerNameInput").value.trim();

    setError("customerFormError", "");

    if (!customerNumber || !customerName) {
        setError("customerFormError", "Please fill in both fields.");
        return;
    }

    setButtonLoading("saveCustomerButton", true);

    try {
        const now = new Date().toISOString();

        if (editingCustomerId) {
            const { data, error } = await supabaseClient
                .from("customers")
                .update({
                    customer_number: customerNumber,
                    customer_name: customerName,
                    updated_at: now
                })
                .eq("id", editingCustomerId)
                .select()
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                throw new Error(
                    "Customer was not updated. Check your Supabase permissions."
                );
            }

            selectedCustomerId = data.id;
        } else {
            const { data, error } = await supabaseClient
                .from("customers")
                .insert({
                    id: makeId(),
                    customer_number: customerNumber,
                    customer_name: customerName,
                    created_at: now,
                    updated_at: now
                })
                .select()
                .single();

            if (error) throw error;

            selectedCustomerId = data.id;
        }

        $("customerDialog").close();

        await loadCustomers();

        showStatus(
            editingCustomerId ? "Customer updated successfully." : "Customer added successfully.",
            "success"
        );
    } catch (error) {
        console.error("Save customer error:", error);
        setError("customerFormError", getErrorMessage(error));
    } finally {
        setButtonLoading("saveCustomerButton", false);
    }
}

async function deleteSelectedCustomer() {
    const customer = customers.find(
        item => item.id === selectedCustomerId
    );

    if (!customer) return;

    const confirmed = window.confirm(
        `Delete "${customer.customer_name}" and all its notes? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
        showStatus("Deleting customer...");

        const { error: itemsError } = await supabaseClient
            .from("customer_items")
            .delete()
            .eq("customer_id", customer.id);

        if (itemsError) throw itemsError;

        const { error: customerError } = await supabaseClient
            .from("customers")
            .delete()
            .eq("id", customer.id);

        if (customerError) throw customerError;

        selectedCustomerId = null;

        await loadCustomers();

        showStatus("Customer deleted successfully.", "success");
    } catch (error) {
        console.error("Delete customer error:", error);
        showStatus(getErrorMessage(error), "error");
    }
}

/* =========================================
   9. ADD AND EDIT NOTES
========================================= */

function openItemDialog(item = null) {
    if (!selectedCustomerId) {
        showStatus("Please select a customer first.", "error");
        return;
    }

    editingItemId = item ? item.id : null;

    $("itemForm").reset();
    setError("itemFormError", "");

    $("itemDialogTitle").textContent =
        item ? "Edit Note" : "Add Note";

    $("saveNoteButton").textContent =
        item ? "Save Changes" : "Save Note";

    $("itemTextInput").innerHTML =
        item ? getSafeNoteHtml(item.text) : "";

    $("itemDialog").showModal();
    $("itemTextInput").focus();
}

async function handleItemSave(event) {
    event.preventDefault();

    setError("itemFormError", "");

    const rawHtml = $("itemTextInput").innerHTML.trim();

    if (
        !$("itemTextInput").textContent.trim() &&
        !$("itemTextInput").querySelector("img")
    ) {
        setError("itemFormError", "Please enter a note before saving.");
        return;
    }

    let noteHtml;

    try {
        noteHtml = sanitizeNoteHtml(rawHtml);
    } catch (error) {
        setError("itemFormError", getErrorMessage(error));
        return;
    }

    setButtonLoading("saveNoteButton", true);

    try {
        const now = new Date().toISOString();

        if (editingItemId) {
            const existingItem = customerItems.find(
                item => item.id === editingItemId
            );

            if (!existingItem) {
                throw new Error("The note could not be found. Refresh and try again.");
            }

            const { data, error } = await supabaseClient
                .from("customer_items")
                .update({
                    type: "Text",
                    text: noteHtml,
                    file_path: null
                })
                .eq("id", editingItemId)
                .eq("customer_id", selectedCustomerId)
                .select()
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                throw new Error(
                    "The note was not updated. Check your Supabase permissions."
                );
            }
        } else {
            const nextSortOrder = customerItems.length
                ? Math.max(...customerItems.map(item =>
                    Number(item.sort_order) || 0
                )) + 1
                : 1;

            const { error } = await supabaseClient
                .from("customer_items")
                .insert({
                    id: makeId(),
                    customer_id: selectedCustomerId,
                    type: "Text",
                    text: noteHtml,
                    file_path: null,
                    original_file_name: null,
                    sort_order: nextSortOrder,
                    created_at: now
                });

            if (error) throw error;
        }

        $("itemDialog").close();

        await loadCustomerItems(selectedCustomerId);

        showStatus(
            editingItemId ? "Note updated successfully." : "Note saved successfully.",
            "success"
        );
    } catch (error) {
        console.error("Save note error:", error);
        setError("itemFormError", getErrorMessage(error));
    } finally {
        setButtonLoading("saveNoteButton", false);
    }
}

async function deleteItem(itemId) {
    const item = customerItems.find(note => note.id === itemId);

    if (!item) return;

    if (!window.confirm("Are you sure you want to delete this note?")) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("customer_items")
            .delete()
            .eq("id", itemId)
            .eq("customer_id", selectedCustomerId);

        if (error) throw error;

        await loadCustomerItems(selectedCustomerId);

        showStatus("Note deleted successfully.", "success");
    } catch (error) {
        console.error("Delete note error:", error);
        showStatus(getErrorMessage(error), "error");
    }
}

/* =========================================
   10. RICH TEXT EDITOR
========================================= */

function applyEditorCommand(command, value = null) {
    $("itemTextInput").focus();

    try {
        document.execCommand(command, false, value);
    } catch (error) {
        console.error("Editor command error:", error);
    }
}

function setupEditor() {
    document.querySelectorAll("[data-command]").forEach(button => {
        button.addEventListener("click", () => {
            applyEditorCommand(button.dataset.command);
        });
    });

    $("fontSizeSelect").addEventListener("change", event => {
        applyEditorCommand("fontSize", event.target.value);
        event.target.value = "3";
    });

    $("textAlignSelect").addEventListener("change", event => {
        const commands = {
            left: "justifyLeft",
            center: "justifyCenter",
            right: "justifyRight"
        };

        applyEditorCommand(commands[event.target.value] || "justifyLeft");
    });

    $("clearFormattingButton").addEventListener("click", () => {
        applyEditorCommand("removeFormat");
    });
}

/* =========================================
   11. EVENT LISTENERS
========================================= */

function setupEventListeners() {
    $("loginForm").addEventListener("submit", handleLogin);

    $("logoutButton").addEventListener("click", handleLogout);

    $("addCustomerButton").addEventListener("click", () => {
        openCustomerDialog();
    });

    $("customerForm").addEventListener("submit", handleCustomerSave);

    $("editCustomerButton").addEventListener("click", () => {
        const customer = customers.find(
            item => item.id === selectedCustomerId
        );

        if (customer) openCustomerDialog(customer);
    });

    $("deleteCustomerButton").addEventListener(
        "click",
        deleteSelectedCustomer
    );

    $("addNoteButton").addEventListener("click", () => {
        openItemDialog();
    });

    $("itemForm").addEventListener("submit", handleItemSave);

    $("customerSearch").addEventListener("input", renderCustomers);

    $("refreshButton").addEventListener("click", loadCustomers);

    $("customerList").addEventListener("click", event => {
        const button = event.target.closest("[data-customer-id]");

        if (!button) return;

        selectCustomer(button.dataset.customerId);
    });

    $("notesList").addEventListener("click", event => {
        const editButton = event.target.closest("[data-edit-item]");
        const deleteButton = event.target.closest("[data-delete-item]");

        if (editButton) {
            const item = customerItems.find(
                note => note.id === editButton.dataset.editItem
            );

            if (item) openItemDialog(item);
        }

        if (deleteButton) {
            deleteItem(deleteButton.dataset.deleteItem);
        }
    });

    document.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => {
            const dialog = $(button.dataset.close);

            if (dialog) dialog.close();
        });
    });

    
    document.querySelectorAll("dialog").forEach(dialog => {
        dialog.addEventListener("click", event => {
            // Do not close the dialog when clicking outside it.
            if (event.target === dialog) {
                event.preventDefault();
            }
        });

        // Prevent accidental closing with the Escape key.
        dialog.addEventListener("cancel", event => {
            event.preventDefault();
        });
    });


    setupEditor();
}

$("closeNoteButton").addEventListener("click", () => {
    const confirmed = window.confirm(
        "Close the editor? Your unsaved changes will be lost."
    );

    if (confirmed) {
        $("itemDialog").close();
    }
});


/* =========================================
   12. START APPLICATION
========================================= */

async function initializeApp() {
    setupEventListeners();

    if (sessionStorage.getItem(SESSION_KEY) === "true") {
        showApplication();
        await loadCustomers();
    } else {
        showLogin();
    }
}

document.addEventListener("DOMContentLoaded", initializeApp);
