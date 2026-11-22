# 04: Folder Hierarchy Preservation, Client-Side ZIP Packaging & Directory Save

**What to build:** Reconstruct received folders cleanly in Enhanced Mode. Upon completing a folder transfer, CrocFlow packages all verified files into a client-side `.zip` archive matching the sender's original directory structure, offering a one-click "Tải về file ZIP (Download ZIP)" button. When supported by the browser (`window.showDirectoryPicker`), also provide a "Lưu trực tiếp vào thư mục (Save to Folder)" button using the File System Access API. Sanitize all relative paths to reject directory traversal (`..` or leading slashes).

**Blocked by:** 01: Domain Vocabulary Normalization, Branded Codephrase & Bridge Client Unification

**Status:** resolved

- [x] Pure client-side zip creation utility implemented with deflate compression.
- [x] Received folder files packaged into a downloadable `.zip` file preserving nested relative paths.
- [x] Directory save option provided via File System Access API where available.
- [x] Path sanitization strictly rejects `..` segments and leading slashes before packaging or saving.
- [x] Unit tests verify zip generation, directory hierarchy preservation, and traversal rejection.
