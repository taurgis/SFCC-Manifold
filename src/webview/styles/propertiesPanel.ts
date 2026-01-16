/**
 * CSS styles for the Properties Panel
 * Displays node details when selected
 */

export function getPropertiesPanelStyles(): string {
  return `
    /* Properties Panel */
    .properties-panel {
      width: 320px;
      min-width: 320px;
      height: 100%;
      background: linear-gradient(180deg, #11162d 0%, #0d1226 100%);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 100;
      transform: translateX(100%);
      position: absolute;
      right: 0;
      top: 0;
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .properties-panel.visible {
      transform: translateX(0);
    }

    /* Resize Handle */
    .properties-resize-handle {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 6px;
      cursor: ew-resize;
      background: transparent;
      z-index: 10;
      transition: background 0.15s ease;
    }

    .properties-resize-handle:hover,
    .properties-resize-handle.dragging {
      background: var(--accent);
    }

    .properties-panel.resizing {
      transition: none;
      user-select: none;
    }

    body.resizing-panel {
      cursor: ew-resize !important;
      user-select: none !important;
    }

    body.resizing-panel * {
      cursor: ew-resize !important;
    }

    .properties-header {
      padding: 0;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(90deg, #161d38, #11162d);
      flex-shrink: 0;
    }

    .properties-header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
    }

    .properties-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .properties-title svg {
      width: 14px;
      height: 14px;
      opacity: 0.8;
    }

    .properties-close {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .properties-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text);
    }

    .properties-close svg {
      width: 16px;
      height: 16px;
    }

    .properties-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding-bottom: 80px;
    }

    /* Empty State */
    .properties-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 32px;
      text-align: center;
    }

    .empty-icon {
      width: 48px;
      height: 48px;
      color: var(--border);
      margin-bottom: 16px;
      opacity: 0.6;
    }

    .empty-icon svg {
      width: 100%;
      height: 100%;
    }

    .empty-text {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .empty-hint {
      font-size: 11px;
      color: var(--muted);
      opacity: 0.6;
    }

    /* Node Header Section */
    .node-header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(22, 29, 56, 0.5), transparent);
    }

    .node-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .node-type-badge svg {
      width: 14px;
      height: 14px;
    }

    .node-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
      word-break: break-word;
      line-height: 1.4;
    }

    .node-id {
      font-size: 11px;
      font-family: "SF Mono", "Fira Code", monospace;
      color: var(--muted);
      margin-top: 6px;
      padding: 4px 8px;
      background: rgba(10, 14, 26, 0.5);
      border-radius: 4px;
      display: inline-block;
    }

    /* Properties Sections */
    .properties-section {
      padding: 16px;
      border-bottom: 1px solid var(--border);
    }

    .properties-section:last-child {
      border-bottom: none;
    }

    .properties-section-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--muted);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .properties-section-title svg {
      width: 12px;
      height: 12px;
      opacity: 0.7;
    }

    /* Property Items */
    .property-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }

    .property-item:last-child {
      margin-bottom: 0;
    }

    .property-label {
      font-size: 11px;
      color: var(--muted);
      text-transform: capitalize;
    }

    .property-value {
      font-size: 12px;
      color: var(--text);
      word-break: break-word;
      line-height: 1.4;
    }

    .property-value.monospace {
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 11px;
      background: rgba(10, 14, 26, 0.8);
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      white-space: pre-wrap;
    }

    .property-value.empty {
      color: var(--muted);
      font-style: italic;
      opacity: 0.6;
    }

    /* Connection Items */
    .connection-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .connection-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: rgba(10, 14, 26, 0.6);
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .connection-item:hover {
      background: rgba(10, 14, 26, 0.9);
      border-color: var(--accent);
    }

    .connection-direction {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      flex-shrink: 0;
    }

    .connection-direction.incoming {
      background: rgba(107, 232, 199, 0.15);
      color: var(--success);
    }

    .connection-direction.outgoing {
      background: rgba(109, 211, 255, 0.15);
      color: var(--accent);
    }

    .connection-direction svg {
      width: 14px;
      height: 14px;
    }

    .connection-info {
      flex: 1;
      min-width: 0;
    }

    .connection-node-name {
      font-size: 12px;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .connection-edge-label {
      font-size: 10px;
      color: var(--muted);
      margin-top: 2px;
    }

    .connection-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      flex-shrink: 0;
    }

    /* No connections state */
    .no-connections {
      font-size: 12px;
      color: var(--muted);
      font-style: italic;
      opacity: 0.6;
      text-align: center;
      padding: 8px;
    }

    /* Attributes Grid */
    .attributes-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .attribute-item {
      background: rgba(10, 14, 26, 0.6);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
    }

    .attribute-key {
      font-size: 10px;
      font-weight: 600;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .attribute-value {
      font-size: 12px;
      color: var(--text);
      word-break: break-word;
      line-height: 1.4;
    }

    .attribute-value.empty {
      color: var(--muted);
      font-style: italic;
      opacity: 0.6;
    }

    /* Branch badge */
    .branch-path {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .branch-segment {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      background: rgba(10, 14, 26, 0.8);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 11px;
      font-family: "SF Mono", "Fira Code", monospace;
      color: var(--text);
    }

    .branch-separator {
      color: var(--muted);
      font-size: 10px;
    }

    /* Description content */
    .description-content {
      font-size: 12px;
      color: var(--text);
      line-height: 1.6;
      background: rgba(10, 14, 26, 0.6);
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    /* Bindings styles */
    .bindings-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .binding-item {
      display: flex;
      align-items: stretch;
      background: rgba(10, 14, 26, 0.6);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }

    .binding-key,
    .binding-alias {
      flex: 1;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .binding-key {
      background: rgba(109, 211, 255, 0.05);
    }

    .binding-alias {
      background: rgba(107, 232, 199, 0.05);
    }

    .binding-key-label,
    .binding-alias-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
    }

    .binding-key-value {
      font-size: 11px;
      font-family: "SF Mono", "Fira Code", monospace;
      color: var(--accent);
      word-break: break-all;
    }

    .binding-alias-value {
      font-size: 11px;
      font-family: "SF Mono", "Fira Code", monospace;
      color: var(--success);
      word-break: break-all;
    }

    .binding-alias-value.empty {
      color: var(--muted);
      font-style: italic;
      opacity: 0.6;
    }

    .binding-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 8px;
      background: rgba(10, 14, 26, 0.8);
      color: var(--muted);
    }

    .binding-arrow svg {
      width: 14px;
      height: 14px;
    }

    /* Template styles */
    .template-info {
      background: rgba(10, 14, 26, 0.6);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }

    .template-name {
      font-size: 12px;
      font-family: "SF Mono", "Fira Code", monospace;
      color: var(--text);
      margin-bottom: 8px;
      word-break: break-all;
    }

    .template-flags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .template-flag {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .template-flag.buffered {
      background: rgba(109, 211, 255, 0.15);
      color: var(--accent);
    }

    .template-flag.dynamic {
      background: rgba(242, 192, 120, 0.15);
      color: var(--warning);
    }

    .template-flag.static {
      background: rgba(147, 164, 200, 0.15);
      color: var(--muted);
    }
  `;
}
