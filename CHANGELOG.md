# Changelog

All notable changes to the ENSight Extension project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive technical documentation (`DOCUMENTATION.md`)
  - Complete architecture overview covering 3-layer system
  - Input/output specifications
  - Development workflow and tooling guide
  - Security model documentation
  - Future roadmap and feature planning
  - Troubleshooting guide
  - Integration points with ensight-backend and ensight-web

- Quick reference guide (`QUICK-REFERENCE.md`)
  - Fast-lookup component summary
  - Message flow diagrams
  - What works vs. what doesn't checklist
  - Common development patterns
  - Testing procedures
  - Code style conventions

- Formal input/output specification (`INPUT-OUTPUT-SPEC.md`)
  - Detailed input requirements and formats
  - Output behavior specifications
  - System requirements (development, runtime, browser, wallet)
  - Validation criteria and test checklists
  - Data flow diagrams

- Project changelog (`CHANGELOG.md`)

### Documentation Improvements
- Clarified that extension is in "Detection Phase" (can detect wallets, but not yet intercept transactions)
- Documented the three JavaScript contexts (page, content script, background worker)
- Explained why `<all_urls>` permission is required
- Added security guarantees and privacy model
- Included future development priorities

---

## [0.0.0] - 2026-02-05 (Pre-release)

### Added
- Initial extension setup with WXT framework
- Background service worker with message handling
- Content script with wallet detection capabilities
- Page context injection script (`ethereum-main-world.ts`)
- Wallet provider detection for EIP-1193 compliant wallets
- Cross-context messaging infrastructure
- React-based popup UI scaffold
- TypeScript configuration
- Development tooling (dev, build, compile scripts)

### Features
- ✅ Detects `window.ethereum` on web pages
- ✅ Handles both synchronous and asynchronous wallet injection
- ✅ Supports MetaMask `ethereum#initialized` event
- ✅ Message passing between page context → content script → background worker
- ✅ Console logging for debugging
- ✅ Hot reload during development

### Technical
- WXT 0.20.6 with React module
- React 19.2.3
- TypeScript 5.9.3
- Chrome Manifest V3 compatibility
- Web-accessible resources configuration for page injection

### Known Limitations
- ❌ No transaction interception (only detects wallet presence)
- ❌ No transaction parsing or intent extraction
- ❌ No risk analysis implementation
- ❌ No side panel UI (only detection phase)
- ❌ No backend integration
- ❌ No user settings or configuration

### Developer Notes
- See `shernan-notes.md` for original development thought process
- Project built at ETHGlobal HackMoney 2026

---

## Release Notes

### Version 0.0.0 - Detection Phase

This is the initial implementation focusing on reliable wallet provider detection. The extension can identify when a Web3 wallet is present on a page but does not yet intercept or analyze transactions.

**Next Phase**: Transaction interception and parameter extraction.

---

**Links**:
- [ENSight Extension Documentation](./DOCUMENTATION.md)
- [Quick Reference Guide](./QUICK-REFERENCE.md)
- [Input/Output Specification](./INPUT-OUTPUT-SPEC.md)
- [Developer Notes](./shernan-notes.md)
