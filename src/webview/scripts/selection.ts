/**
 * Node selection and properties panel management script
 * Handles node click events, panel visibility, and rendering node details
 */

export function getSelectionScript(): string {
  return `
    /**
     * State management for selection
     */
    var selectedNodeId = null;
    var nodeGroups = {};

    /**
     * Initialize the properties panel with event handlers
     */
    function initPropertiesPanel() {
      var panel = document.getElementById("propertiesPanel");
      var closeBtn = document.getElementById("propertiesClose");
      var content = document.getElementById("propertiesContent");

      closeBtn.addEventListener("click", function() {
        hidePropertiesPanel();
        clearSelection();
      });

      // Close panel on escape key
      document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && panel.classList.contains("visible")) {
          hidePropertiesPanel();
          clearSelection();
        }
      });

      // Event delegation for connection item clicks
      content.addEventListener("click", function(e) {
        var target = e.target;
        // Walk up the DOM tree to find a connection-item
        while (target && target !== content) {
          if (target.classList && target.classList.contains("connection-item")) {
            var nodeId = target.getAttribute("data-node-id");
            if (nodeId && window.handleConnectionClick) {
              window.handleConnectionClick(nodeId);
            }
            return;
          }
          target = target.parentElement;
        }
      });

      // Initialize resize functionality
      initPanelResize();
    }

    /**
     * Initialize panel resize drag functionality
     */
    function initPanelResize() {
      var panel = document.getElementById("propertiesPanel");
      var handle = document.getElementById("propertiesResizeHandle");
      var isResizing = false;
      var startX = 0;
      var startWidth = 0;
      var minWidth = 280;
      var maxWidth = 600;

      handle.addEventListener("mousedown", function(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        
        panel.classList.add("resizing");
        handle.classList.add("dragging");
        document.body.classList.add("resizing-panel");
        
        e.preventDefault();
      });

      document.addEventListener("mousemove", function(e) {
        if (!isResizing) return;
        
        var delta = startX - e.clientX;
        var newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
        panel.style.width = newWidth + "px";
        panel.style.minWidth = newWidth + "px";
      });

      document.addEventListener("mouseup", function() {
        if (isResizing) {
          isResizing = false;
          panel.classList.remove("resizing");
          handle.classList.remove("dragging");
          document.body.classList.remove("resizing-panel");
        }
      });
    }

    /**
     * Show the properties panel
     */
    function showPropertiesPanel() {
      var panel = document.getElementById("propertiesPanel");
      panel.classList.add("visible");
    }

    /**
     * Hide the properties panel
     */
    function hidePropertiesPanel() {
      var panel = document.getElementById("propertiesPanel");
      panel.classList.remove("visible");
    }

    /**
     * Clear selection state
     */
    function clearSelection() {
      if (selectedNodeId && nodeGroups[selectedNodeId]) {
        updateNodeVisual(selectedNodeId, false);
      }
      selectedNodeId = null;
    }

    /**
     * Update node visual state (selected/unselected)
     * When selected: fills node with type color and inverts text for readability
     */
    function updateNodeVisual(nodeId, isSelected) {
      var group = nodeGroups[nodeId];
      if (!group) return;

      // Get the node data to access its color
      var nodeData = findNodeById(nodeId);
      var nodeColor = nodeData ? (colors[nodeData.type] || colors.unknown) : colors.unknown;

      // Try to find Rect first (for regular nodes)
      var rects = group.find("Rect");
      if (rects && rects.length > 0) {
        // First rect is the main background
        var mainRect = rects[0];
        
        if (isSelected) {
          // Fill with node type color
          mainRect.fill(nodeColor);
          mainRect.stroke("#ffffff");
          mainRect.strokeWidth(3);
          mainRect.shadowBlur(30);
          mainRect.shadowOpacity(0.8);
          mainRect.shadowColor(nodeColor);
          
          // Hide the gradient overlay (second rect)
          if (rects[1]) {
            rects[1].opacity(0);
          }
          
          // Invert text colors for readability
          var texts = group.find("Text");
          for (var i = 0; i < texts.length; i++) {
            var text = texts[i];
            // Store original color if not already stored
            if (!text.getAttr("originalFill")) {
              text.setAttr("originalFill", text.fill());
            }
            // Type pill text stays dark, other text becomes dark for contrast
            text.fill("#0b1021");
          }
          
          // Update type pill background to white for contrast
          var pillRect = rects[2]; // Third rect is the pill background
          if (pillRect) {
            if (!pillRect.getAttr("originalFill")) {
              pillRect.setAttr("originalFill", pillRect.fill());
            }
            pillRect.fill("rgba(255, 255, 255, 0.9)");
          }
        } else {
          // Restore original appearance
          mainRect.fill("#0d1328");
          mainRect.stroke(nodeColor);
          mainRect.strokeWidth(2);
          mainRect.shadowBlur(15);
          mainRect.shadowOpacity(0.4);
          mainRect.shadowColor("#000");
          
          // Show the gradient overlay again
          if (rects[1]) {
            rects[1].opacity(1);
          }
          
          // Restore text colors
          var texts = group.find("Text");
          for (var i = 0; i < texts.length; i++) {
            var text = texts[i];
            var originalFill = text.getAttr("originalFill");
            if (originalFill) {
              text.fill(originalFill);
            }
          }
          
          // Restore pill background
          var pillRect = rects[2];
          if (pillRect) {
            var originalPillFill = pillRect.getAttr("originalFill");
            if (originalPillFill) {
              pillRect.fill(originalPillFill);
            }
          }
        }
        return;
      }

      // Try to find Circle (for join nodes)
      var circles = group.find("Circle");
      if (circles && circles.length > 0) {
        // Find the main circle (the one with stroke)
        for (var i = 0; i < circles.length; i++) {
          var circle = circles[i];
          if (circle.strokeWidth() > 0) {
            if (isSelected) {
              // Fill with node type color
              circle.fill(nodeColor);
              circle.stroke("#ffffff");
              circle.strokeWidth(4);
              circle.shadowBlur(20);
              circle.shadowOpacity(0.8);
              circle.shadowColor(nodeColor);
            } else {
              // Restore original appearance
              circle.fill("#0d1328");
              circle.stroke(nodeColor);
              circle.strokeWidth(2);
              circle.shadowBlur(10);
              circle.shadowOpacity(0.4);
              circle.shadowColor("#000");
            }
            break;
          }
        }
      }
    }

    /**
     * Handle node selection
     */
    function selectNode(node, layer) {
      // Deselect previous node
      if (selectedNodeId && selectedNodeId !== node.id) {
        updateNodeVisual(selectedNodeId, false);
      }

      // Select new node
      selectedNodeId = node.id;
      updateNodeVisual(node.id, true);
      layer.batchDraw();

      // Show panel and render properties
      showPropertiesPanel();
      renderNodeProperties(node);
    }

    /**
     * Navigate to a connected node
     */
    function navigateToNode(nodeId, stage, layer, placedNodes) {
      var node = null;
      for (var i = 0; i < placedNodes.length; i++) {
        if (placedNodes[i].id === nodeId) {
          node = placedNodes[i];
          break;
        }
      }
      
      if (!node) return;

      // Center the view on the target node
      var container = document.getElementById("konva-container");
      var containerRect = container.getBoundingClientRect();
      var scale = stage.scaleX();
      
      var newX = containerRect.width / 2 - (node.x + nodeWidth / 2) * scale;
      var newY = containerRect.height / 2 - (node.y + nodeHeight / 2) * scale;
      
      stage.position({ x: newX, y: newY });
      
      // Select the node
      selectNode(node, layer);
    }

    /**
     * Render node properties in the panel
     */
    function renderNodeProperties(node) {
      var content = document.getElementById("propertiesContent");
      var color = colors[node.type] || colors.unknown;

      // Find connections
      var incoming = [];
      var outgoing = [];
      
      for (var i = 0; i < pipelineData.edges.length; i++) {
        var edge = pipelineData.edges[i];
        if (edge.to === node.id) {
          incoming.push(edge);
        }
        if (edge.from === node.id) {
          outgoing.push(edge);
        }
      }

      // Order: Header, then high-priority info (config, bindings, attributes, template, description),
      // then lower-priority info (connections, location)
      content.innerHTML = renderNodeHeader(node, color) +
                          renderConfigPropertiesSection(node) +
                          renderBindingsSection(node) +
                          renderAttributesSection(node) +
                          renderTemplateSection(node) +
                          renderDescriptionSection(node) +
                          renderConnectionsSection(incoming, outgoing, node) +
                          renderLocationSection(node);
    }

    /**
     * Render node header with type badge and name
     */
    function renderNodeHeader(node, color) {
      var typeIcon = getNodeTypeIcon(node.type);
      
      return '<div class="node-header">' +
        '<div class="node-type-badge" style="background: ' + color + '22; color: ' + color + ';">' +
          typeIcon +
          '<span>' + escapeHtml(node.type) + '</span>' +
        '</div>' +
        '<div class="node-name">' + escapeHtml(node.label) + '</div>' +
        '<div class="node-id">' + escapeHtml(node.id) + '</div>' +
      '</div>';
    }

    /**
     * Render location section with branch path
     */
    function renderLocationSection(node) {
      var branchParts = node.branch.split("/");
      var branchHtml = "";
      
      for (var i = 0; i < branchParts.length; i++) {
        if (i > 0) {
          branchHtml += '<span class="branch-separator">›</span>';
        }
        branchHtml += '<span class="branch-segment">' + escapeHtml(branchParts[i]) + '</span>';
      }
      
      return '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.location +
          'Location' +
        '</div>' +
        '<div class="branch-path">' + branchHtml + '</div>' +
      '</div>';
    }

    /**
     * Render connections section
     */
    function renderConnectionsSection(incoming, outgoing, currentNode) {
      var html = '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.connections +
          'Connections (' + (incoming.length + outgoing.length) + ')' +
        '</div>';

      if (incoming.length === 0 && outgoing.length === 0) {
        html += '<div class="no-connections">No connections</div>';
      } else {
        html += '<div class="connection-list">';
        
        // Incoming connections
        for (var i = 0; i < incoming.length; i++) {
          var edge = incoming[i];
          var fromNode = findNodeById(edge.from);
          html += renderConnectionItem(fromNode, edge, "incoming", fromNode ? colors[fromNode.type] : colors.unknown);
        }
        
        // Outgoing connections
        for (var i = 0; i < outgoing.length; i++) {
          var edge = outgoing[i];
          var toNode = findNodeById(edge.to);
          html += renderConnectionItem(toNode, edge, "outgoing", toNode ? colors[toNode.type] : colors.unknown);
        }
        
        html += '</div>';
      }

      html += '</div>';
      return html;
    }

    /**
     * Find a node by ID from placed nodes
     */
    function findNodeById(id) {
      for (var i = 0; i < pipelineData.nodes.length; i++) {
        if (pipelineData.nodes[i].id === id) {
          return pipelineData.nodes[i];
        }
      }
      return null;
    }

    /**
     * Render a single connection item
     */
    function renderConnectionItem(connectedNode, edge, direction, color) {
      var dirIcon = direction === "incoming" ? iconSvgs.arrowDown : iconSvgs.arrowUp;
      var nodeName = connectedNode ? connectedNode.label : edge.from || edge.to;
      var nodeType = connectedNode ? connectedNode.type : "unknown";
      var nodeId = direction === "incoming" ? edge.from : edge.to;
      
      return '<div class="connection-item" data-node-id="' + escapeAttr(nodeId) + '">' +
        '<div class="connection-direction ' + direction + '">' +
          dirIcon +
        '</div>' +
        '<div class="connection-info">' +
          '<div class="connection-node-name">' + escapeHtml(nodeName) + '</div>' +
          (edge.label ? '<div class="connection-edge-label">' + escapeHtml(edge.label) + '</div>' : '') +
        '</div>' +
        '<div class="connection-badge" style="background: ' + color + '22; color: ' + color + ';">' +
          escapeHtml(nodeType) +
        '</div>' +
      '</div>';
    }

    /**
     * Render description section for text nodes
     */
    function renderDescriptionSection(node) {
      if (!node.description) {
        return '';
      }
      
      return '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.text +
          'Description' +
        '</div>' +
        '<div class="description-content">' + escapeHtml(node.description) + '</div>' +
      '</div>';
    }

    /**
     * Render config properties section for pipelet nodes
     */
    function renderConfigPropertiesSection(node) {
      var configProps = node.configProperties;
      if (!configProps || configProps.length === 0) {
        return '';
      }
      
      var html = '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.settings +
          'Configuration (' + configProps.length + ')' +
        '</div>' +
        '<div class="attributes-grid">';
      
      for (var i = 0; i < configProps.length; i++) {
        var prop = configProps[i];
        var displayValue = prop.value !== undefined && prop.value !== null && prop.value !== "" 
          ? escapeHtml(String(prop.value)) 
          : '<span class="empty">empty</span>';
        
        html += '<div class="attribute-item">' +
          '<div class="attribute-key">' + escapeHtml(prop.key) + '</div>' +
          '<div class="attribute-value">' + displayValue + '</div>' +
        '</div>';
      }
      
      html += '</div></div>';
      return html;
    }

    /**
     * Render bindings section for pipelet and loop nodes
     */
    function renderBindingsSection(node) {
      var bindings = node.bindings;
      if (!bindings || bindings.length === 0) {
        return '';
      }
      
      var html = '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.binding +
          'Key Bindings (' + bindings.length + ')' +
        '</div>' +
        '<div class="bindings-list">';
      
      for (var i = 0; i < bindings.length; i++) {
        var binding = bindings[i];
        html += '<div class="binding-item">' +
          '<div class="binding-key">' +
            '<span class="binding-key-label">Key</span>' +
            '<span class="binding-key-value">' + escapeHtml(binding.key) + '</span>' +
          '</div>' +
          '<div class="binding-arrow">' + iconSvgs.arrowRight + '</div>' +
          '<div class="binding-alias">' +
            '<span class="binding-alias-label">Alias</span>' +
            '<span class="binding-alias-value' + (binding.alias ? '' : ' empty') + '">' + 
              (binding.alias ? escapeHtml(binding.alias) : 'empty') + 
            '</span>' +
          '</div>' +
        '</div>';
      }
      
      html += '</div></div>';
      return html;
    }

    /**
     * Render template section for interaction nodes
     */
    function renderTemplateSection(node) {
      var template = node.template;
      if (!template) {
        return '';
      }
      
      return '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.template +
          'Template' +
        '</div>' +
        '<div class="template-info">' +
          '<div class="template-name">' + escapeHtml(template.name) + '</div>' +
          '<div class="template-flags">' +
            (template.buffered ? '<span class="template-flag buffered">Buffered</span>' : '') +
            (template.dynamic ? '<span class="template-flag dynamic">Dynamic</span>' : '<span class="template-flag static">Static</span>') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    /**
     * Render attributes section
     */
    function renderAttributesSection(node) {
      var attrs = node.attributes || {};
      var keys = Object.keys(attrs);
      
      if (keys.length === 0) {
        return '<div class="properties-section">' +
          '<div class="properties-section-title">' +
            iconSvgs.settings +
            'Attributes' +
          '</div>' +
          '<div class="no-connections">No attributes</div>' +
        '</div>';
      }

      var html = '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.settings +
          'Attributes (' + keys.length + ')' +
        '</div>' +
        '<div class="attributes-grid">';
      
      // Sort keys for consistent display
      keys.sort();
      
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = attrs[key];
        var displayValue = value !== undefined && value !== null && value !== "" 
          ? escapeHtml(String(value)) 
          : '<span class="empty">empty</span>';
        
        html += '<div class="attribute-item">' +
          '<div class="attribute-key">' + escapeHtml(formatAttributeKey(key)) + '</div>' +
          '<div class="attribute-value">' + displayValue + '</div>' +
        '</div>';
      }
      
      html += '</div></div>';
      return html;
    }

    /**
     * Format attribute key for display (convert kebab-case to readable)
     */
    function formatAttributeKey(key) {
      return key.replace(/-/g, " ").replace(/_/g, " ");
    }

    /**
     * Get appropriate icon for node type
     */
    function getNodeTypeIcon(type) {
      switch (type) {
        case "start": return iconSvgs.play;
        case "end": return iconSvgs.stop;
        case "pipelet": return iconSvgs.box;
        case "call": return iconSvgs.phoneCall;
        case "jump": return iconSvgs.arrowRight;
        case "interaction": return iconSvgs.user;
        case "decision": return iconSvgs.gitBranch;
        case "join": return iconSvgs.merge;
        case "loop": return iconSvgs.repeat;
        case "text": return iconSvgs.text;
        default: return iconSvgs.circle;
      }
    }

    /**
     * Escape HTML for safe rendering
     */
    function escapeHtml(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    /**
     * Escape string for use in HTML attributes
     */
    function escapeAttr(str) {
      if (!str) return "";
      return String(str)
        .replace(/\\\\/g, "\\\\\\\\")
        .replace(/'/g, "\\\\'")
        .replace(/"/g, "&quot;");
    }

    /**
     * SVG icons for the properties panel
     */
    var iconSvgs = {
      location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
      connections: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
      settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
      binding: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
      arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19,12 12,19 5,12"/></svg>',
      arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/></svg>',
      arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>',
      play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,3 19,12 5,21 5,3"/></svg>',
      stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/></svg>',
      box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
      phoneCall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      gitBranch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
      merge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 9v6"/><path d="M18 9a9 9 0 0 0-9 9"/></svg>',
      repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,7 4,4 20,4 20,7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
      circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
    };
  `;
}
