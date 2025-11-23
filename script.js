// === DOM elements ===
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");

const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");

const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

// Use your Cloudflare Worker endpoint
const WORKER_URL = "https://lingering-cherry-b621.dcbela.workers.dev/";

// App state
let allProducts = [];
let selectedProductIds = new Set();

// Conversation history for AI
const messages = [
  {
    role: "system",
    content: `
You are a helpful beauty advisor for L'Oréal brands (CeraVe, L'Oréal Paris, Garnier, Vichy, Lancôme, Kérastase, etc.).
Your job is to:
- Build skincare, haircare, and makeup routines using the selected products.
- Answer follow-up questions about how to use them.
- Keep responses practical, friendly, and easy to follow.

Stay on topics like products, ingredients, application steps, skin / hair concerns, or fragrances.
If asked anything unrelated to beauty or L'Oréal products, reply:
"I'm here to help with L'Oréal beauty products and routines only."`
  }
];

// === Utility: chat UI ===
function addMessage(text, sender = "ai") {
  const div = document.createElement("div");
  div.classList.add("msg", sender);
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement("div");
  div.classList.add("msg", "system");
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// === Load products ===
async function loadProducts() {
  const res = await fetch("products.json");
  const data = await res.json();
  return data.products;
}

// === LocalStorage helpers ===
const STORAGE_KEY = "lorealSelectedProducts";

function saveSelections() {
  const idsArray = Array.from(selectedProductIds);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(idsArray));
}

function loadSelectionsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const ids = JSON.parse(raw);
    selectedProductIds = new Set(ids);
  } catch (e) {
    console.error("Error reading selections from storage", e);
  }
}

// === Render products grid ===
function renderProductsGrid(products) {
  if (!products || !products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your filters. Try another category or search term.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((p) => {
      const isSelected = selectedProductIds.has(p.id);
      return `
        <article class="product-card ${isSelected ? "selected" : ""}" data-id="${
        p.id
      }">
          <div class="product-image-wrap">
            <img src="${p.image}" alt="${p.name}">
          </div>
          <div class="product-info">
            <div class="category-tag">${p.category}</div>
            <div class="product-brand">${p.brand}</div>
            <div class="product-name">${p.name}</div>
            <p class="product-description">${p.description}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

// === Render selected products pills ===
function renderSelectedProducts() {
  if (!selectedProductIds.size) {
    selectedProductsList.innerHTML = `<span class="placeholder-message" style="padding:10px 0;font-size:14px;">No products selected yet.</span>`;
    return;
  }

  const selected = allProducts.filter((p) => selectedProductIds.has(p.id));

  selectedProductsList.innerHTML = selected
    .map(
      (p) => `
      <div class="selected-pill" data-id="${p.id}">
        <span>${p.brand} — ${p.name}</span>
        <button class="pill-remove" aria-label="Remove ${p.name}">&times;</button>
      </div>
    `
    )
    .join("");
}

// === Filter logic (category + search) ===
function applyFilters() {
  if (!allProducts.length) return;

  const category = categoryFilter.value;
  const term = productSearch.value.trim().toLowerCase();

  let filtered = allProducts.slice();

  if (category && category !== "all") {
    filtered = filtered.filter(
      (p) =>
        p.category &&
        p.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (term) {
    filtered = filtered.filter((p) => {
      const haystack = (
        (p.name || "") +
        " " +
        (p.brand || "") +
        " " +
        (p.category || "") +
        " " +
        (p.description || "")
      ).toLowerCase();
      return haystack.includes(term);
    });
  }

  renderProductsGrid(filtered);
}

// === Product selection toggling ===
function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }
  saveSelections();
  applyFilters();
  renderSelectedProducts();
}

// === AI call via Cloudflare Worker ===
async function callAI() {
  const thinking = document.createElement("div");
  thinking.classList.add("msg", "ai");
  thinking.textContent = "⏳ Thinking about your routine…";
  chatWindow.appendChild(thinking);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    const data = await res.json();

    thinking.remove();

    if (data.error) {
      console.error("OpenAI error:", data.error);
      addMessage(
        `⚠️ OpenAI error: ${
          data.error.message || JSON.stringify(data.error)
        }`,
        "ai"
      );
      return;
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response.";

    addMessage(reply, "ai");
    messages.push({ role: "assistant", content: reply });
  } catch (err) {
    console.error("Chat error:", err);
    thinking.remove();
    addMessage("⚠️ Error: Could not connect to the server.", "ai");
  }
}

// === Event listeners ===

// Category & search
categoryFilter.addEventListener("change", applyFilters);
productSearch.addEventListener("input", applyFilters);

// Click on a product card -> toggle selection
productsContainer.addEventListener("click", (evt) => {
  const card = evt.target.closest(".product-card");
  if (!card) return;
  const id = Number(card.dataset.id);
  toggleProductSelection(id);
});

// Remove a pill
selectedProductsList.addEventListener("click", (evt) => {
  if (!evt.target.classList.contains("pill-remove")) return;
  const pill = evt.target.closest(".selected-pill");
  const id = Number(pill.dataset.id);
  toggleProductSelection(id);
});

// Clear all selections
clearSelectionsBtn.addEventListener("click", () => {
  selectedProductIds.clear();
  saveSelections();
  applyFilters();
  renderSelectedProducts();
});

// Generate routine based on selected products
generateRoutineBtn.addEventListener("click", () => {
  const selected = allProducts.filter((p) => selectedProductIds.has(p.id));
  if (!selected.length) {
    addMessage(
      "Please select at least one product before generating a routine.",
      "ai"
    );
    return;
  }

  const summary = selected
    .map((p) => `${p.brand} — ${p.name} (${p.category})`)
    .join("\n- ");

  const userMessage = `
Create a step-by-step routine using ONLY these products:

- ${summary}

Explain when to use each product (AM/PM), the order of steps, and any tips for sensitive or dry skin.
Keep it friendly and easy to follow for a regular customer.
  `.trim();

  messages.push({ role: "user", content: userMessage });
  addMessage("Here are the products I selected. Can you build a routine?", "user");

  callAI();
});

// Follow-up chat
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  messages.push({ role: "user", content: text });
  userInput.value = "";

  callAI();
});

// === Initialize app on load ===
window.addEventListener("DOMContentLoaded", async () => {
  try {
    allProducts = await loadProducts();
    loadSelectionsFromStorage();
    renderSelectedProducts();
    applyFilters();
    addSystemMessage(
      "Tip: Choose a category, click products to select them, then hit “Generate Routine.” You can ask follow-up questions in the chat."
    );
  } catch (e) {
    console.error("Error loading products:", e);
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Couldn't load products. Please check your products.json file.
      </div>
    `;
  }
});
