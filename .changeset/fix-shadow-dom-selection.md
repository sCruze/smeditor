---
"@smeditor/core": patch
---

Fix caret and selection synchronization when SMEditor is mounted inside Shadow DOM by resolving the live Selection from the editor root instead of the outer document.
