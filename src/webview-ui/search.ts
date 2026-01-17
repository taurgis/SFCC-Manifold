/**
 * Search functionality for finding nodes in the pipeline
 */

import type Konva from "konva";
import { NODE_COLORS } from "./constants";
import { placedNodes } from "./state";
import { getNodeTypeIcon, iconSvgs } from "./icons";
import { navigateToNode } from "./selection";
import { updateViewportCulling } from "./viewport";
import { debounce } from "./utils";
import type { PlacedNode } from "./types";

interface SearchResult {
  node: PlacedNode;
  matchType: "name" | "type" | "id" | "branch";
  score: number;
}

let isSearchOpen = false;
let selectedIndex = 0;
let currentResults: SearchResult[] = [];

/**
 * Initialize search functionality
 */
export function initSearch(): void {
  const overlay = document.getElementById("searchOverlay");
  const input = document.getElementById("searchInput") as HTMLInputElement;
  const searchToggle = document.getElementById("searchToggle");

  if (!overlay || !input) return;

  // Toggle button click
  searchToggle?.addEventListener("click", () => {
    openSearch();
  });

  // Keyboard shortcut (Cmd/Ctrl + F)
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "f") {
      e.preventDefault();
      if (isSearchOpen) {
        closeSearch();
      } else {
        openSearch();
      }
    }
  });

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeSearch();
    }
  });

  // Search input handler with debounce
  const debouncedSearch = debounce((query: unknown) => {
    performSearch(String(query));
  }, 100);

  input.addEventListener("input", () => {
    debouncedSearch(input.value);
  });

  // Keyboard navigation
  input.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "Escape":
        closeSearch();
        break;
      case "ArrowDown":
        e.preventDefault();
        navigateResults(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        navigateResults(-1);
        break;
      case "Enter":
        e.preventDefault();
        selectCurrentResult();
        break;
    }
  });

  // Click on result item
  const resultsContainer = document.getElementById("searchResults");
  resultsContainer?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const resultItem = target.closest(".search-result-item");
    if (resultItem) {
      const index = parseInt(resultItem.getAttribute("data-index") || "0", 10);
      selectedIndex = index;
      selectCurrentResult();
    }
  });
}

/**
 * Open the search panel
 */
export function openSearch(): void {
  const overlay = document.getElementById("searchOverlay");
  const input = document.getElementById("searchInput") as HTMLInputElement;
  const searchToggle = document.getElementById("searchToggle");

  if (!overlay || !input) return;

  isSearchOpen = true;
  overlay.classList.add("visible");
  searchToggle?.classList.add("active");
  
  // Reset state
  input.value = "";
  selectedIndex = 0;
  currentResults = [];
  
  // Show empty state
  renderEmptyState();
  
  // Focus input
  setTimeout(() => input.focus(), 50);
}

/**
 * Close the search panel
 */
export function closeSearch(): void {
  const overlay = document.getElementById("searchOverlay");
  const searchToggle = document.getElementById("searchToggle");

  if (!overlay) return;

  isSearchOpen = false;
  overlay.classList.remove("visible");
  searchToggle?.classList.remove("active");
}

/**
 * Perform search and update results
 */
function performSearch(query: string): void {
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) {
    currentResults = [];
    selectedIndex = 0;
    renderEmptyState();
    return;
  }

  // Search through all placed nodes
  const results: SearchResult[] = [];

  for (const node of placedNodes) {
    const score = calculateMatchScore(node, trimmedQuery);
    if (score > 0) {
      const matchType = getMatchType(node, trimmedQuery);
      results.push({ node, matchType, score });
    }
  }

  // Sort by score (higher is better)
  results.sort((a, b) => b.score - a.score);

  // Limit results
  currentResults = results.slice(0, 50);
  selectedIndex = 0;

  renderResults(trimmedQuery);
}

/**
 * Calculate match score for a node
 */
function calculateMatchScore(node: PlacedNode, query: string): number {
  let score = 0;
  const labelLower = node.label.toLowerCase();
  const typeLower = node.type.toLowerCase();
  const idLower = node.id.toLowerCase();
  const branchLower = node.branch.toLowerCase();

  // Exact match in label (highest priority)
  if (labelLower === query) {
    score += 100;
  } else if (labelLower.startsWith(query)) {
    score += 80;
  } else if (labelLower.includes(query)) {
    score += 60;
  }

  // Type match
  if (typeLower === query) {
    score += 50;
  } else if (typeLower.startsWith(query)) {
    score += 40;
  } else if (typeLower.includes(query)) {
    score += 30;
  }

  // ID match
  if (idLower === query) {
    score += 40;
  } else if (idLower.startsWith(query)) {
    score += 30;
  } else if (idLower.includes(query)) {
    score += 20;
  }

  // Branch match
  if (branchLower.includes(query)) {
    score += 10;
  }

  // Boost certain node types that are commonly searched
  if (score > 0 && (node.type === "pipelet" || node.type === "decision" || node.type === "interaction")) {
    score += 5;
  }

  return score;
}

/**
 * Get the primary match type for display
 */
function getMatchType(node: PlacedNode, query: string): "name" | "type" | "id" | "branch" {
  const labelLower = node.label.toLowerCase();
  const typeLower = node.type.toLowerCase();
  const idLower = node.id.toLowerCase();

  if (labelLower.includes(query)) return "name";
  if (typeLower.includes(query)) return "type";
  if (idLower.includes(query)) return "id";
  return "branch";
}

/**
 * Render empty state
 */
function renderEmptyState(): void {
  const resultsContainer = document.getElementById("searchResults");
  const emptyState = document.getElementById("searchEmpty");
  const footer = document.getElementById("searchFooter");

  if (resultsContainer && emptyState) {
    resultsContainer.innerHTML = `
      <div class="search-empty" id="searchEmpty">
        <span class="search-empty-icon">${iconSvgs.search}</span>
        <span class="search-empty-text">Type to search pipelets, decisions, and more...</span>
      </div>
    `;
  }

  if (footer) {
    footer.style.display = "flex";
  }
}

/**
 * Render search results
 */
function renderResults(query: string): void {
  const resultsContainer = document.getElementById("searchResults");
  const footer = document.getElementById("searchFooter");

  if (!resultsContainer) return;

  if (currentResults.length === 0) {
    resultsContainer.innerHTML = `
      <div class="search-no-results">
        <span class="search-no-results-text">
          No results for <span class="search-no-results-query">"${escapeHtml(query)}"</span>
        </span>
      </div>
    `;
    if (footer) footer.style.display = "none";
    return;
  }

  let html = `<div class="search-results-count">${currentResults.length} result${currentResults.length !== 1 ? "s" : ""}</div>`;
  html += '<div class="search-results-list">';

  for (let i = 0; i < currentResults.length; i++) {
    const { node, matchType } = currentResults[i];
    const isSelected = i === selectedIndex;
    const color = NODE_COLORS[node.type] || NODE_COLORS.unknown;
    const icon = getNodeTypeIcon(node.type);

    // Highlight matching text
    const highlightedLabel = highlightMatch(node.label, query);
    const metaText = getMetaText(node, matchType, query);

    html += `
      <div class="search-result-item${isSelected ? " selected" : ""}" data-index="${i}">
        <div class="search-result-icon" style="background: ${color}22; color: ${color};">
          ${icon}
        </div>
        <div class="search-result-info">
          <div class="search-result-name">${highlightedLabel}</div>
          <div class="search-result-meta">${metaText}</div>
        </div>
        <div class="search-result-type" style="background: ${color}22; color: ${color};">
          ${escapeHtml(node.type)}
        </div>
      </div>
    `;
  }

  html += "</div>";
  resultsContainer.innerHTML = html;

  if (footer) footer.style.display = "flex";

  // Scroll selected item into view
  scrollSelectedIntoView();
}

/**
 * Get meta text for result item
 */
function getMetaText(node: PlacedNode, matchType: string, query: string): string {
  const parts: string[] = [];

  // Show branch path
  const branchParts = node.branch.split("/");
  if (branchParts.length > 1) {
    parts.push(branchParts.slice(0, -1).join(" › "));
  }

  // Show ID if it matched
  if (matchType === "id") {
    parts.push(`ID: ${highlightMatch(node.id, query)}`);
  }

  return parts.join(" • ") || node.branch;
}

/**
 * Highlight matching text with <mark> tags
 */
function highlightMatch(text: string, query: string): string {
  const escaped = escapeHtml(text);
  const queryEscaped = escapeHtml(query);
  const regex = new RegExp(`(${escapeRegExp(queryEscaped)})`, "gi");
  return escaped.replace(regex, "<mark>$1</mark>");
}

/**
 * Navigate through results with arrow keys
 */
function navigateResults(direction: number): void {
  if (currentResults.length === 0) return;

  selectedIndex += direction;

  if (selectedIndex < 0) {
    selectedIndex = currentResults.length - 1;
  } else if (selectedIndex >= currentResults.length) {
    selectedIndex = 0;
  }

  updateSelectedResult();
  scrollSelectedIntoView();
}

/**
 * Update the selected result visual state
 */
function updateSelectedResult(): void {
  const items = document.querySelectorAll(".search-result-item");
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  });
}

/**
 * Scroll selected item into view
 */
function scrollSelectedIntoView(): void {
  const selected = document.querySelector(".search-result-item.selected");
  if (selected) {
    selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

/**
 * Select the current result and navigate to it
 */
function selectCurrentResult(): void {
  if (currentResults.length === 0 || selectedIndex >= currentResults.length) {
    return;
  }

  const result = currentResults[selectedIndex];
  closeSearch();

  // Navigate to the node on the canvas
  if (window.pipelineStage && window.pipelineLayer && window.placedNodes) {
    navigateToNode(
      result.node.id,
      window.pipelineStage,
      window.pipelineLayer,
      window.placedNodes
    );
    window.drawGridFn?.();
    updateViewportCulling(window.pipelineStage, window.pipelineLayer);
    window.pipelineLayer.batchDraw();
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
