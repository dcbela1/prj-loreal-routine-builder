// ===============================
//  DOM ELEMENTS
// ===============================
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateBtn = document.getElementById("generateRoutine");

const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// 🔑 Use your real Cloudflare Worker URL here
const WORKER_URL = "https://lingering-cherry-b621.dcbela.workers.dev";

// All products from products.json
let allProducts = [];

// Store selected product IDs (numbers)
let selectedProductIds = new Set();

// Conversation history for OpenAI
const messages = [
  {
    role: "system",
    content: `
You are a L'Oréal Routine Builder Assistant.

You ONLY answer questions about:
- L'Oréal, Garnier, CeraVe, Lancôme, Kiehl's, Kérastase, and other L'Oréal brands
- Skincare, haircare, makeup, fragrance, and beauty routines

When creating routines:
- Use ONLY the products the user selected from the list
- Explain AM/PM and the order to use products
- Keep answers clear, friendly, and not too long

If someone asks about anything not related to beauty or L'Oréal brands, reply:
"I'm here to help with L'Oréal-related products and beauty routines only."
`
  }
];

// ===============================
//  INITIAL SETUP
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  // Placeholder message until a category is chosen
  productsContainer.innerHTML = `
    <div class="placeholder-message">
      Select a category to view products.
    </div>
  `;

  // Load product data
  allProducts = await loadProducts();

  // Load saved selections from localStorage (if any)
  loadSelections();

  // Render selected products pills (if there were saved ones)
  updateSelectedProductsUI();

  // Friendly greeting in chat
  addMessage(
    "👋 Hi! I’m your L’Oréal routine builder. Choose a category, pick some products, then hit “Generate Routine.”",
    "ai"
  );
});

// ===============================
//  LOAD PRODUCTS
// ===============================
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

// ===============================
//  RENDER PRODUCTS GRID
// ===============================
function renderProductsGrid(products) {
  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found for this category.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (p) => `
    <div class="product-card" data-id="${p.id}">
      <img src="${p.image}" alt="${p.name}">
      <div class="product-info">
        <h3>${p.name}</h3>
        <p class="brand">${p.brand}</p>
        <p class="category-tag">${p.category}</p>
        <p class="product-description">
          ${p.description}
        </p>
      </div>
    </div>
  `
    )
    .join("");

  // Add click handlers for selection
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = Number(card.dataset.id);
      toggleProductSelection(id);
    });
  });

  // Sync visual state for already-selected items
  syncProductCardSelection();
}

// ===============================
//  CATEGORY FILTER
// ===============================
categoryFilter.addEventListener("change", () => {
  const category = categoryFilter.value;
  const filtered = allProducts.filter((p) => p.category === category);
  renderProductsGrid(filtered);
});

// ===============================
//  PRODUCT SEARCH
// ===============================
productSearch.addEventListener("input", () => {
  applyFilters();
});
categoryFilter.addEventListener("change", () => {
  applyFilters();
});

// ===============================
//  HELPER FUNCTION
// ===============================
function applyFilters() {
  const category = categoryFilter.value;
  const term = productSearch.value.trim().toLowerCase();

  let filtered = allProducts;

  if (category) {
    filtered = filtered.filter((p) => p.category === category);
  }

  if (term) {
    filtered = filtered.filter((p) => {
      const haystack = (
        p.name +
        " " +
        p.brand +
        " " +
        p.category +
        " " +
        p.description
      ).toLowerCase();
      return haystack.includes(term);
    });
  }

  renderProductsGrid(filtered);
}

// ===============================
//  SELECT / UNSELECT PRODUCTS
// ===============================
function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  saveSelections();
  updateSelectedProductsUI();
  syncProductCardSelection();
}

function syncProductCardSelection() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const id = Number(card.dataset.id);
    if (selectedProductIds.has(id)) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
}

// ===============================
//  SELECTED PRODUCTS UI
// ===============================
function getSelectedProducts() {
  return allProducts.filter((p) => selectedProductIds.has(p.id));
}

function updateSelectedProductsUI() {
  const selected = getSelectedProducts();

  if (!selected.length) {
    selectedProductsList.innerHTML =
      '<p class="selected-empty">No products selected yet.</p>';
    return;
  }

  selectedProductsList.innerHTML = selected
    .map(
      (p) => `
    <div class="selected-pill" data-id="${p.id}">
      <span>${p.name}</span>
      <button type="button" class="pill-remove" aria-label="Remove ${p.name}">
        ×
      </button>
    </div>
  `
    )
    .join("");

  // Hook up remove buttons
  document.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pill = btn.closest(".selected-pill");
      const id = Number(pill.dataset.id);
      selectedProductIds.delete(id);
      saveSelections();
      updateSelectedProductsUI();
      syncProductCardSelection();
    });
  });
}

// ===============================
//  LOCALSTORAGE (SAVE SELECTIONS)
// ===============================
function saveSelections() {
  const idsArray = Array.from(selectedProductIds);
  localStorage.setItem("lorealSelectedProducts", JSON.stringify(idsArray));
}

function loadSelections() {
  const stored = localStorage.getItem("lorealSelectedProducts");
  if (!stored) return;
  try {
    const idsArray = JSON.parse(stored);
    selectedProductIds = new Set(idsArray);
  } catch (e) {
    console.error("Error reading saved selections:", e);
  }
}

// ===============================
//  GENERATE ROUTINE BUTTON
// ===============================
generateBtn.addEventListener("click", () => {
  const selected = getSelectedProducts();

  if (!selected.length) {
    addMessage("Please select at least one product before generating a routine.", "ai");
    return;
  }

  // Show in chat what we’re doing
  addMessage("Here are the products I’ve chosen. Can you build me a routine?", "user");

  const productInfo = selected.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description
  }));

  messages.push({
    role: "user",
    content: `
The user has selected these products (JSON below).
Please build a clear step-by-step routine using ONLY these products.
Explain AM/PM, order of use, and any short tips.

Selected products:
${JSON.stringify(productInfo, null, 2)}
`
  });

  sendToAI("⏳ Creating your personalized routine...");
});

// ===============================
//  CHAT: FOLLOW-UP QUESTIONS
// ===============================
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  messages.push({ role: "user", content: text });

  userInput.value = "";
  sendToAI("⏳ Thinking about your routine...");
});

// ===============================
//  SEND TO CLOUDFLARE WORKER
// ===============================
async function sendToAI(loadingText) {
  const thinkingEl = addMessage(loadingText, "ai", true);

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    const data = await res.json();

    let reply;
    if (data.error) {
      const err = data.error;
      const msg =
        typeof err === "string"
          ? err
          : err.message || JSON.stringify(err);
      reply = "⚠️ OpenAI error: " + msg;
    } else if (data.choices && data.choices[0]?.message?.content) {
      reply = data.choices[0].message.content;
      messages.push({ role: "assistant", content: reply });
    } else {
      reply = "Sorry, I couldn’t generate a response.";
    }

    thinkingEl.remove();
    addMessage(reply, "ai");
  } catch (err) {
    console.error("Chat error:", err);
    thinkingEl.remove();
    addMessage("⚠️ Could not connect to the AI server.", "ai");
  }
}

// ===============================
//  CHAT UI HELPER
// ===============================
function addMessage(text, sender = "ai", returnElement = false) {
  const div = document.createElement("div");
  div.classList.add("msg", sender === "user" ? "user" : "ai");
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  if (returnElement) return div;
}
