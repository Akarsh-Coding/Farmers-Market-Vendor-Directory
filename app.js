(function () {
    "use strict";

    var STORAGE_KEY = "farmersMarketVendors_v1";

    var defaultVendors = [
        { id: 1, name: "Green Valley Produce", category: "Produce", booth: "A-12", phone: "(555) 201-3344", description: "Locally grown seasonal vegetables and heirloom tomatoes." },
        { id: 2, name: "Hearth & Grain Bakery", category: "Bakery", booth: "B-04", phone: "(555) 204-9981", description: "Sourdough, rye, and pastries baked fresh each morning." },
        { id: 3, name: "Meadow Creek Dairy", category: "Dairy & Eggs", booth: "A-07", phone: "(555) 209-6612", description: "Pasture-raised eggs and small-batch artisan cheese." },
        { id: 4, name: "Rolling Hills Ranch", category: "Meat & Poultry", booth: "C-02", phone: "(555) 213-7754", description: "Grass-fed beef and free-range chicken, cut to order." },
        { id: 5, name: "Spice Route Kitchen", category: "Prepared Foods", booth: "B-09", phone: "(555) 217-4420", description: "Ready-to-eat curries, dumplings, and rice bowls." },
        { id: 6, name: "Cold Press Collective", category: "Beverages", booth: "D-01", phone: "(555) 220-8890", description: "Cold-pressed juices and kombucha on tap." },
        { id: 7, name: "Petal & Stem Flowers", category: "Flowers & Plants", booth: "A-15", phone: "(555) 224-1102", description: "Seasonal bouquets and potted herb starters." },
        { id: 8, name: "Woven Basket Co.", category: "Crafts & Goods", booth: "C-06", phone: "(555) 227-5543", description: "Handwoven baskets, market totes, and linen napkins." },
        { id: 9, name: "Sunrise Orchard", category: "Produce", booth: "A-03", phone: "(555) 230-9911", description: "Tree-ripened stone fruit and apple cider by the jug." },
        { id: 10, name: "Old Mill Grains", category: "Bakery", booth: "B-11", phone: "(555) 234-6678", description: "Stone-ground flour, granola, and whole-grain crackers." }
    ];

    function loadStoredVendors() {
        try {
            var raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            return (Array.isArray(parsed) && parsed.length > 0) ? parsed : null;
        } catch (err) {
            return null; // storage unavailable or corrupted — fall back to defaults
        }
    }

    function saveVendors() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vendors));
        } catch (err) {
            // Private browsing / storage disabled — changes just won't persist across reloads.
        }
    }

    var stored = loadStoredVendors();
    var vendors = stored ? stored : defaultVendors.slice();
    var nextId = vendors.reduce(function (max, v) { return Math.max(max, v.id); }, 0) + 1;

    var editingId = null;              // id of vendor currently being edited, or null when adding
    var confirmingDeleteIds = {};      // map of vendor id -> true while its inline delete confirmation is showing

    var grid = document.getElementById("vendor-grid");
    var statusLine = document.getElementById("status-line");
    var vendorCountBadge = document.getElementById("vendor-count");
    var searchForm = document.getElementById("search-toolbar");
    var searchInput = document.getElementById("search-input");
    var categoryFilter = document.getElementById("category-filter");
    var sortSelect = document.getElementById("sort-select");
    var addVendorDetails = document.getElementById("add-vendor-details");
    var addVendorForm = document.getElementById("add-vendor-form");
    var addVendorTitle = document.getElementById("add-vendor-title");
    var submitBtn = document.getElementById("submit-vendor-btn");
    var cancelBtn = document.getElementById("cancel-vendor-btn");
    var errorSummary = document.getElementById("form-error-summary");
    var successBox = document.getElementById("form-success");
    var formModeIndicator = document.getElementById("form-mode-indicator");
    var formModeText = document.getElementById("form-mode-text");
    var exitEditBtn = document.getElementById("exit-edit-btn");


    // Telemetry: fired once per completed primary action, per spec.
    function logAnalytics() {
        console.log("[Analytics] User interacted with Farmers Market Vendor Directory");
    }

    // Security: strip tags/scripts and encode before ever storing user input.
    function sanitize(value) {
        var withoutTags = String(value || "").replace(/<[^>]*>/g, "");
        var div = document.createElement("div");
        div.textContent = withoutTags;
        return div.innerHTML.trim();
    }

    function populateCategoryFilter() {
        var seen = {};
        vendors.forEach(function (v) { seen[v.category] = true; });
        Object.keys(seen).sort().forEach(function (cat) {
            var opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            categoryFilter.appendChild(opt);
        });
    }

    function wait(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function updateVendorCountBadge() {
        if (!vendorCountBadge) return;
        vendorCountBadge.textContent = vendors.length + (vendors.length === 1 ? " Vendor" : " Vendors");
    }

    function findVendorIndexById(id) {
        var idx = -1;
        vendors.forEach(function (v, i) { if (v.id === id) idx = i; });
        return idx;
    }

    function buildEmptyState() {
        var wrap = document.createElement("div");
        wrap.className = "empty-state";
        wrap.innerHTML =
            '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="7" stroke="#94A3B8" stroke-width="2"/>' +
            '<line x1="16.2" y1="16.2" x2="21" y2="21" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>' +
            '</svg>' +
            '<p>No vendors found. Try a different name or category.</p>';
        return wrap;
    }

    function buildVendorCard(vendor) {
        var card = document.createElement("article");
        card.className = "vendor-card";
        card.setAttribute("aria-label", vendor.name);

        var booth = document.createElement("span");
        booth.className = "booth-tag";
        booth.textContent = "Booth " + vendor.booth;
        card.appendChild(booth);

        var h3 = document.createElement("h3");
        h3.textContent = vendor.name;
        card.appendChild(h3);

        var badge = document.createElement("span");
        badge.className = "category-badge";
        badge.textContent = vendor.category;
        card.appendChild(badge);

        var desc = document.createElement("p");
        desc.className = "vendor-desc";
        desc.textContent = vendor.description;
        card.appendChild(desc);

        var phone = document.createElement("p");
        phone.className = "vendor-meta";
        phone.textContent = "Contact: " + vendor.phone;
        card.appendChild(phone);

        if (confirmingDeleteIds[vendor.id]) {
            card.appendChild(buildConfirmDeleteRow(vendor));
        } else {
            card.appendChild(buildCardActions(vendor));
        }

        return card;
    }

    function buildCardActions(vendor) {
        var actions = document.createElement("div");
        actions.className = "card-actions";

        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "icon-btn edit-btn";
        editBtn.textContent = "Edit";
        editBtn.setAttribute("aria-label", "Edit " + vendor.name);
        editBtn.addEventListener("click", function () { startEdit(vendor.id); });
        actions.appendChild(editBtn);

        var deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "icon-btn delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.setAttribute("aria-label", "Delete " + vendor.name);
        deleteBtn.addEventListener("click", function () { requestDelete(vendor.id); });
        actions.appendChild(deleteBtn);

        return actions;
    }

    function buildConfirmDeleteRow(vendor) {
        var confirmRow = document.createElement("div");
        confirmRow.className = "confirm-delete-row";

        var msg = document.createElement("p");
        msg.textContent = "Remove " + vendor.name + " from the directory?";
        confirmRow.appendChild(msg);

        var yesBtn = document.createElement("button");
        yesBtn.type = "button";
        yesBtn.className = "confirm-btn";
        yesBtn.textContent = "Delete";
        yesBtn.addEventListener("click", function () { confirmDelete(vendor.id); });
        confirmRow.appendChild(yesBtn);

        var noBtn = document.createElement("button");
        noBtn.type = "button";
        noBtn.className = "confirm-cancel-btn";
        noBtn.textContent = "Keep vendor";
        noBtn.addEventListener("click", function () { cancelDeleteRequest(vendor.id); });
        confirmRow.appendChild(noBtn);

        return confirmRow;
    }

    function renderVendors(list) {
        grid.innerHTML = "";
        if (list.length === 0) {
            grid.appendChild(buildEmptyState());
            return;
        }
        list.forEach(function (vendor) {
            grid.appendChild(buildVendorCard(vendor));
        });
    }

    function sortVendors(list) {
        var sortValue = sortSelect ? sortSelect.value : "name-asc";
        var sorted = list.slice();
        sorted.sort(function (a, b) {
            switch (sortValue) {
                case "name-desc":
                    return b.name.localeCompare(a.name);
                case "category-asc":
                    return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
                case "booth-asc":
                    return a.booth.localeCompare(b.booth, undefined, { numeric: true });
                case "name-asc":
                default:
                    return a.name.localeCompare(b.name);
            }
        });
        return sorted;
    }

    function getFilteredVendors() {
        var term = searchInput.value.trim().toLowerCase();
        var cat = categoryFilter.value;
        var filtered = vendors.filter(function (v) {
            var matchesTerm = !term || v.name.toLowerCase().indexOf(term) !== -1;
            var matchesCat = !cat || v.category === cat;
            return matchesTerm && matchesCat;
        });
        return sortVendors(filtered);
    }

    function runSearch() {
        statusLine.classList.add("is-loading");
        statusLine.textContent = "Searching…";

        wait(500).then(function () {
            var results = getFilteredVendors();
            renderVendors(results);
            statusLine.classList.remove("is-loading");
            statusLine.textContent = results.length === 1
                ? "1 vendor found"
                : results.length + " vendors found";
            logAnalytics();
        });
    }

    searchForm.addEventListener("submit", function (e) {
        e.preventDefault();
        runSearch();
    });
    searchInput.addEventListener("input", debounce(runSearch, 350));
    categoryFilter.addEventListener("change", runSearch);
    sortSelect.addEventListener("change", runSearch);

    function debounce(fn, delay) {
        var timer;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(fn, delay);
        };
    }

    function requestDelete(id) {
        confirmingDeleteIds[id] = true;
        renderVendors(getFilteredVendors());
    }

    function cancelDeleteRequest(id) {
        delete confirmingDeleteIds[id];
        renderVendors(getFilteredVendors());
    }

    function confirmDelete(id) {
        var idx = findVendorIndexById(id);
        if (idx === -1) return;
        var removed = vendors[idx];

        vendors.splice(idx, 1);
        delete confirmingDeleteIds[id];

        if (editingId === id) {
            exitEditMode();
            addVendorForm.reset();
            Object.keys(validators).forEach(setFieldValid);
            clearFormMessages();
            addVendorDetails.open = false;
        }

        saveVendors();
        renderVendors(getFilteredVendors());
        updateVendorCountBadge();

        statusLine.classList.remove("is-loading");
        statusLine.textContent = vendors.length + " vendors in directory";

        successBox.textContent = "Vendor removed: " + removed.name + ".";
        successBox.classList.add("show");

        logAnalytics();
    }

    var validators = {
        name: function (v) { return v.trim().length >= 2 && v.trim().length <= 60; },
        category: function (v) { return v !== ""; },
        booth: function (v) { return /^[A-Za-z0-9-]{1,10}$/.test(v.trim()); },
        phone: function (v) { return /^[0-9()+\-\s]{7,15}$/.test(v.trim()); },
        description: function (v) { return v.trim().length >= 10 && v.trim().length <= 160; }
    };

    function setFieldValid(name) {
        document.getElementById("group-" + name).classList.remove("invalid");
    }
    function setFieldInvalid(name) {
        document.getElementById("group-" + name).classList.add("invalid");
    }

    function validateForm(data) {
        var invalidFields = [];
        Object.keys(validators).forEach(function (field) {
            var isValid = validators[field](data[field]);
            if (isValid) { setFieldValid(field); }
            else { setFieldInvalid(field); invalidFields.push(field); }
        });
        return invalidFields;
    }

    function clearFormMessages() {
        errorSummary.classList.remove("show");
        errorSummary.textContent = "";
        successBox.classList.remove("show");
        successBox.textContent = "";
    }

    function startEdit(id) {
        var idx = findVendorIndexById(id);
        if (idx === -1) return;
        var vendor = vendors[idx];

        editingId = id;
        Object.keys(confirmingDeleteIds).forEach(function (key) { delete confirmingDeleteIds[key]; });

        document.getElementById("vendor-name").value = vendor.name;
        document.getElementById("vendor-category").value = vendor.category;
        document.getElementById("vendor-booth").value = vendor.booth;
        document.getElementById("vendor-phone").value = vendor.phone;
        document.getElementById("vendor-description").value = vendor.description;

        Object.keys(validators).forEach(setFieldValid);
        clearFormMessages();

        addVendorTitle.textContent = "Edit Vendor";
        submitBtn.textContent = "Update Vendor";
        formModeText.textContent = "Editing " + vendor.name + ".";
        formModeIndicator.classList.add("show");

        addVendorDetails.open = true;
        addVendorDetails.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById("vendor-name").focus();
    }

    function exitEditMode() {
        editingId = null;
        addVendorTitle.textContent = "Add New Vendor";
        submitBtn.textContent = "Save Vendor";
        formModeIndicator.classList.remove("show");
        formModeText.textContent = "";
    }

    exitEditBtn.addEventListener("click", function () {
        exitEditMode();
        addVendorForm.reset();
        Object.keys(validators).forEach(setFieldValid);
        clearFormMessages();
    });

    addVendorForm.addEventListener("submit", function (e) {
        e.preventDefault();
        clearFormMessages();

        var data = {
            name: document.getElementById("vendor-name").value,
            category: document.getElementById("vendor-category").value,
            booth: document.getElementById("vendor-booth").value,
            phone: document.getElementById("vendor-phone").value,
            description: document.getElementById("vendor-description").value
        };

        var invalidFields = validateForm(data);

        if (invalidFields.length > 0) {
            errorSummary.textContent = "Please fix the highlighted field" +
                (invalidFields.length > 1 ? "s" : "") + " before saving.";
            errorSummary.classList.add("show");
            document.getElementById("vendor-" + invalidFields[0]).focus();
            return; // unhappy path: submission is blocked
        }

        var wasEditing = editingId;

        // Simulate an async save over a slow connection.
        submitBtn.disabled = true;
        submitBtn.textContent = wasEditing ? "Updating…" : "Saving…";
        statusLine.classList.add("is-loading");
        statusLine.textContent = wasEditing ? "Updating vendor…" : "Saving vendor…";

        wait(1200).then(function () {
            var savedVendor;

            if (wasEditing) {
                var idx = findVendorIndexById(wasEditing);
                savedVendor = {
                    id: wasEditing,
                    name: sanitize(data.name),
                    category: sanitize(data.category),
                    booth: sanitize(data.booth),
                    phone: sanitize(data.phone),
                    description: sanitize(data.description)
                };
                if (idx !== -1) {
                    vendors[idx] = savedVendor;
                } else {
                    vendors.unshift(savedVendor); // vendor no longer exists — re-add it
                }
                successBox.textContent = "Vendor updated: " + savedVendor.name + ".";
            } else {
                savedVendor = {
                    id: nextId++,
                    name: sanitize(data.name),
                    category: sanitize(data.category),
                    booth: sanitize(data.booth),
                    phone: sanitize(data.phone),
                    description: sanitize(data.description)
                };
                vendors.unshift(savedVendor);
                successBox.textContent = "Vendor added: " + savedVendor.name + ".";
            }

            saveVendors();
            renderVendors(getFilteredVendors());
            updateVendorCountBadge();
            statusLine.classList.remove("is-loading");
            statusLine.textContent = vendors.length + " vendors in directory";

            successBox.classList.add("show");

            addVendorForm.reset();
            Object.keys(validators).forEach(setFieldValid);
            submitBtn.disabled = false;
            exitEditMode();
            addVendorDetails.open = false;

            logAnalytics();
        });
    });

    cancelBtn.addEventListener("click", function () {
        addVendorForm.reset();
        Object.keys(validators).forEach(setFieldValid);
        clearFormMessages();
        exitEditMode();
        addVendorDetails.open = false;
    });


    populateCategoryFilter();
    renderVendors(getFilteredVendors());
    updateVendorCountBadge();
    statusLine.textContent = vendors.length + " vendors in directory";
})();