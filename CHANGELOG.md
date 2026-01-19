# Changelog

All notable changes to this project will be documented in this file.

## [0.0.6] - 2026-01-19
### Added
- "Go to Source" functionality for pipeline elements
- Pipeline node search functionality
- Bendpoint indicator in legend
- Forced edge bendpoint display
- XML bendpoints support for explicit edge routing
- Pipeline layout dump with A* routing
- Branch filtering for layout dump
- Channel-based edge routing

### Changed
- Re-architected webview UI for enhanced pipeline visualization
- Modularized edge routing logic into shared components
- Enhanced edge routing with collision detection
- Unified edge routing with webview logic
- Improved null safety and code robustness
- Filtered edge waypoints for clarity
- Refactored canvas scripts into modules

### Fixed
- First pipeline segment identification as entry
- Edge arrow rendering and routing
- Edge routing for direct paths and join nodes

### Documentation
- Added SFCC Manifold project structure and architecture guide
- Added guide for debugging edge routing issues
- Organized and expanded developer guides

### Testing
- Integrated Vitest for comprehensive unit tests
- Configured ESLint and Husky for TypeScript
- Added comprehensive pipeline layout integration tests
- Expanded bendpoint routing and properties panel tests
- Expanded test coverage for auto-routing, icons, and UI components

## [0.0.5] - 2026-01-16
### Changed
- Improves canvas rendering performance with viewport culling
- Enhances connection routing for nodes above source

### Fixed
- Ensures final line segment is long enough for arrows

## [0.0.4] - 2026-01-16
### Added
- Join node type and custom routing

### Changed
- Improved connector routing for adjacent nodes

### Fixed
- Improved connection routing for same-row targets

## [0.0.3] - 2026-01-16
- Initial tagged release

[0.0.4]: https://github.com/taurgis/SFCC-Manifold/compare/v0.0.3...v0.0.4
[0.0.5]: https://github.com/taurgis/SFCC-Manifold/compare/v0.0.4...v0.0.5
[0.0.6]: https://github.com/taurgis/SFCC-Manifold/compare/v0.0.5...v0.0.6
[0.0.3]: https://github.com/taurgis/SFCC-Manifold/releases/tag/v0.0.3
