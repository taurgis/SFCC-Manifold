/**
 * Edge properties panel rendering module
 * Handles rendering edge details in the properties panel
 */

export function getEdgePropertiesScript(): string {
  return `
    /**
     * Render edge properties in the panel
     */
    function renderEdgeProperties(edge) {
      var content = document.getElementById("propertiesContent");
      var fromNode = findNodeById(edge.from);
      var toNode = findNodeById(edge.to);
      var edgeColor = getEdgeColor(edge.label);

      var html = renderEdgeHeader(edge, edgeColor);
      html += renderEdgeFromSection(fromNode);
      html += renderEdgeToSection(toNode);
      html += renderEdgeDetailsSection(edge);

      content.innerHTML = html;
    }

    /**
     * Render edge header
     */
    function renderEdgeHeader(edge, edgeColor) {
      return '<div class="node-header">' +
        '<div class="node-type-badge" style="background: ' + edgeColor + '22; color: ' + edgeColor + ';">' +
          iconSvgs.connections +
          '<span>connection</span>' +
        '</div>' +
        '<div class="node-name">' + (edge.label || 'Default Connection') + '</div>' +
      '</div>';
    }

    /**
     * Render "From Node" section
     */
    function renderEdgeFromSection(fromNode) {
      var html = '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.arrowUp +
          'From Node' +
        '</div>';
      
      if (fromNode) {
        var fromColor = colors[fromNode.type] || colors.unknown;
        html += '<div class="connection-item" data-node-id="' + escapeAttr(fromNode.id) + '">' +
          '<div class="connection-info" style="flex: 1;">' +
            '<div class="connection-node-name">' + escapeHtml(fromNode.label) + '</div>' +
            '<div class="connection-edge-label">' + escapeHtml(fromNode.branch) + '</div>' +
          '</div>' +
          '<div class="connection-badge" style="background: ' + fromColor + '22; color: ' + fromColor + ';">' +
            escapeHtml(fromNode.type) +
          '</div>' +
        '</div>';
      } else {
        html += '<div class="no-connections">Node not found</div>';
      }
      html += '</div>';
      return html;
    }

    /**
     * Render "To Node" section
     */
    function renderEdgeToSection(toNode) {
      var html = '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.arrowDown +
          'To Node' +
        '</div>';
      
      if (toNode) {
        var toColor = colors[toNode.type] || colors.unknown;
        html += '<div class="connection-item" data-node-id="' + escapeAttr(toNode.id) + '">' +
          '<div class="connection-info" style="flex: 1;">' +
            '<div class="connection-node-name">' + escapeHtml(toNode.label) + '</div>' +
            '<div class="connection-edge-label">' + escapeHtml(toNode.branch) + '</div>' +
          '</div>' +
          '<div class="connection-badge" style="background: ' + toColor + '22; color: ' + toColor + ';">' +
            escapeHtml(toNode.type) +
          '</div>' +
        '</div>';
      } else {
        html += '<div class="no-connections">Node not found</div>';
      }
      html += '</div>';
      return html;
    }

    /**
     * Render edge details section
     */
    function renderEdgeDetailsSection(edge) {
      return '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.settings +
          'Details' +
        '</div>' +
        '<div class="attributes-grid">' +
          '<div class="attribute-item">' +
            '<div class="attribute-key">Label</div>' +
            '<div class="attribute-value">' + (edge.label ? escapeHtml(edge.label) : '<span class="empty">none</span>') + '</div>' +
          '</div>' +
          '<div class="attribute-item">' +
            '<div class="attribute-key">From ID</div>' +
            '<div class="attribute-value">' + escapeHtml(edge.from) + '</div>' +
          '</div>' +
          '<div class="attribute-item">' +
            '<div class="attribute-key">To ID</div>' +
            '<div class="attribute-value">' + escapeHtml(edge.to) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
  `;
}
