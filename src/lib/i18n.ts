/**
 * Internationalization (i18n) Engine for CrocFlow.
 * Provides type-safe bilingual support (English and Vietnamese)
 * with reactive locale switching, persistence in localStorage, and fallback handling.
 */

export type Locale = "vi" | "en";

export interface Translations {
  common: {
    appName: string;
    tagline: string;
    loading: string;
    success: string;
    error: string;
    cancel: string;
    confirm: string;
    copy: string;
    copied: string;
    save: string;
    saved: string;
    delete: string;
    clear: string;
    refresh: string;
    close: string;
    open: string;
    all: string;
    bytes: string;
    speed: string;
    eta: string;
    status: string;
    actions: string;
    online: string;
    offline: string;
    connected: string;
    disconnected: string;
    active: string;
    idle: string;
    themeLight: string;
    themeDark: string;
    language: string;
    vietnamese: string;
    english: string;
    switchLang: string;
    installed: string;
    installApp: string;
  };
  nav: {
    send: string;
    sendShort: string;
    sendSummary: string;
    receive: string;
    receiveShort: string;
    receiveSummary: string;
    relays: string;
    relaysShort: string;
    relaysSummary: string;
    history: string;
    historyShort: string;
    historySummary: string;
    docs: string;
    docsShort: string;
    docsSummary: string;
    protocolInspector: string;
    hideInspector: string;
    showInspector: string;
  };
  send: {
    title: string;
    subtitle: string;
    modeStandardTitle: string;
    modeStandardDesc: string;
    modeEnhancedTitle: string;
    modeEnhancedDesc: string;
    fileTab: string;
    folderTab: string;
    textTab: string;
    dragDropText: string;
    dragDropFolderText: string;
    browseFiles: string;
    browseFolders: string;
    selectedCount: string;
    totalSize: string;
    clearFiles: string;
    textPlaceholder: string;
    textCharCount: string;
    secretPhrase: string;
    regeneratePhrase: string;
    phraseHint: string;
    optionsTitle: string;
    dualRelayTitle: string;
    dualRelayDesc: string;
    fastestRelayTitle: string;
    fastestRelayDesc: string;
    chunkSizeLabel: string;
    frequentPeersTitle: string;
    quickSendTo: string;
    startSendBtn: string;
    sendingBusy: string;
    qrTitle: string;
    qrHint: string;
    cliCommandHint: string;
    sendSuccess: string;
    sendError: string;
  };
  receive: {
    title: string;
    subtitle: string;
    enterCodeLabel: string;
    codePlaceholder: string;
    connectBtn: string;
    connectingBusy: string;
    modeAutoDetected: string;
    offerTitle: string;
    offerFilesCount: string;
    offerTotalSize: string;
    acceptBtn: string;
    rejectBtn: string;
    downloadingTitle: string;
    downloadSuccess: string;
    downloadError: string;
    downloadZipBtn: string;
    saveFolderBtn: string;
    folderTreeTitle: string;
    resumeCacheTitle: string;
    resumeCacheSummary: string;
    clearResumeCacheBtn: string;
    chunksCached: string;
    bytesCached: string;
    noCachedData: string;
    previewText: string;
  };
  relays: {
    title: string;
    subtitle: string;
    profilePublic: string;
    profilePublicDesc: string;
    profileLocalLab: string;
    profileLocalLabDesc: string;
    profileCustom: string;
    profileCustomDesc: string;
    measureRttBtn: string;
    measuring: string;
    addCustomRelayBtn: string;
    rankTitle: string;
    fastestNode: string;
    latencyMs: string;
    bytesRelayed: string;
    framesRelayed: string;
    customModalTitle: string;
    customNameLabel: string;
    customHostLabel: string;
    customPortLabel: string;
    saveRelayBtn: string;
  };
  history: {
    title: string;
    subtitle: string;
    deviceAliasTitle: string;
    deviceAliasHint: string;
    saveAliasBtn: string;
    groupPassphraseTitle: string;
    groupPassphraseDesc: string;
    newGroupBtn: string;
    groupNameLabel: string;
    groupSecretLabel: string;
    deriveCodeBtn: string;
    currentMonthCode: string;
    useForSendBtn: string;
    useForReceiveBtn: string;
    peerPresetsTitle: string;
    peerPresetsDesc: string;
    addPeerBtn: string;
    peerAliasLabel: string;
    peerNotesLabel: string;
    transferHistoryTitle: string;
    filterAll: string;
    filterSend: string;
    filterReceive: string;
    searchPlaceholder: string;
    clearHistoryBtn: string;
    noHistoryYet: string;
  };
  inspector: {
    title: string;
    subtitle: string;
    pakeHandshake: string;
    chunkGrid: string;
    throughputGraph: string;
    eventLog: string;
    exportLogBtn: string;
    legendAlpha: string;
    legendBeta: string;
    legendVerified: string;
    legendResumed: string;
    legendFailover: string;
    legendPending: string;
  };
  docs: {
    title: string;
    subtitle: string;
    tabNetworking: string;
    tabArchitecture: string;
    tabDemo: string;
    downloadsTitle: string;
    pwaTitle: string;
    androidTitle: string;
    desktopTitle: string;
    exportReportBtn: string;
    interactiveDemoTitle: string;
    runFailoverDemoBtn: string;
    runResumeDemoBtn: string;
    severAlphaBtn: string;
    demoRunning: string;
    demoSuccess: string;
  };
}

export const DICTIONARY: Record<Locale, Translations> = {
  vi: {
    common: {
      appName: "CrocFlow",
      tagline: "Truyền tệp mã hóa đầu cuối PAKE · Đa nền tảng",
      loading: "Đang tải...",
      success: "Thành công",
      error: "Đã xảy ra lỗi",
      cancel: "Hủy bỏ",
      confirm: "Xác nhận",
      copy: "Sao chép",
      copied: "Đã chép!",
      save: "Lưu lại",
      saved: "Đã lưu!",
      delete: "Xóa",
      clear: "Xóa sạch",
      refresh: "Làm mới",
      close: "Đóng",
      open: "Mở",
      all: "Tất cả",
      bytes: "Dung lượng",
      speed: "Tốc độ",
      eta: "Thời gian còn",
      status: "Trạng thái",
      actions: "Thao tác",
      online: "Trực tuyến",
      offline: "Ngoại tuyến",
      connected: "Đã kết nối",
      disconnected: "Mất kết nối",
      active: "Hoạt động",
      idle: "Chờ",
      themeLight: "Giao diện Sáng",
      themeDark: "Giao diện Tối",
      language: "Ngôn ngữ",
      vietnamese: "Tiếng Việt",
      english: "English",
      switchLang: "Chuyển sang English",
      installed: "Đã cài đặt",
      installApp: "Cài ứng dụng",
    },
    nav: {
      send: "Gửi tệp & thư mục",
      sendShort: "Gửi",
      sendSummary: "Chọn tệp, nguyên thư mục hoặc văn bản ngắn, tạo Codephrase PAKE và chia sẻ mã QR.",
      receive: "Nhận tệp & Resume",
      receiveShort: "Nhận",
      receiveSummary: "Nhập Codephrase từ CrocFlow, croc CLI hoặc getcroc.com, xem trước tệp và tải từ Resume Cache.",
      relays: "Relay & Mạng",
      relaysShort: "Relay",
      relaysSummary: "Giám sát cụm Relay công cộng của Croc, đo RTT thực tế và vận hành phòng Lab 2 Relay.",
      history: "Lịch sử & Nhóm",
      historyShort: "Lịch sử",
      historySummary: "Tra cứu Transfer Session đã lưu, đặt Device Alias và quản lý Group Passphrase xoay vòng.",
      docs: "Tải App & Tài liệu",
      docsShort: "Tài liệu",
      docsSummary: "Cài đặt Android APK / Desktop / PWA, chạy kịch bản Demo trực quan và xem cẩm nang kỹ thuật.",
      protocolInspector: "Bảng soi giao thức",
      hideInspector: "Ẩn bảng soi",
      showInspector: "Soi giao thức",
    },
    send: {
      title: "Gửi tệp & dữ liệu an toàn",
      subtitle: "Mã hóa E2E PAKE v2 · Tương thích tuyệt đối croc CLI · Truyền song song 2 Relay",
      modeStandardTitle: "Chuẩn Croc v11",
      modeStandardDesc: "Tương thích 100% với croc CLI & getcroc.com (PAKE P-256 + AES-GCM)",
      modeEnhancedTitle: "Nâng cao CrocFlow",
      modeEnhancedDesc: "Nguyên thư mục · Chunk SHA-256 · Song song 2 Relay · Resume IndexedDB",
      fileTab: "Tệp tin",
      folderTab: "Nguyên thư mục",
      textTab: "Văn bản an toàn",
      dragDropText: "Kéo thả tệp vào đây, hoặc",
      dragDropFolderText: "Kéo thả thư mục vào đây, hoặc",
      browseFiles: "Chọn tệp từ máy",
      browseFolders: "Chọn thư mục",
      selectedCount: "tệp đã chọn",
      totalSize: "Tổng dung lượng",
      clearFiles: "Xóa danh sách",
      textPlaceholder: "Nhập tin nhắn hoặc văn bản mật cần truyền trực tiếp...",
      textCharCount: "ký tự",
      secretPhrase: "Mã bí mật (Codephrase)",
      regeneratePhrase: "Đổi mã ngẫu nhiên",
      phraseHint: "Người nhận chỉ cần nhập mã này hoặc quét QR code để bắt đầu truyền",
      optionsTitle: "Tùy chọn nâng cao",
      dualRelayTitle: "Truyền song song 2 Relay (Alpha + Beta)",
      dualRelayDesc: "Chia chunk chẵn qua Relay Alpha, chunk lẻ qua Relay Beta. Tự động Failover nếu 1 relay mất mạng.",
      fastestRelayTitle: "Tự chọn Relay nhanh nhất (Thấp Ping)",
      fastestRelayDesc: "Tối ưu mã codephrase khớp với relay công cộng có độ trễ RTT thấp nhất.",
      chunkSizeLabel: "Kích thước Chunk",
      frequentPeersTitle: "Gửi nhanh tới thiết bị quen thuộc",
      quickSendTo: "Gửi tới",
      startSendBtn: "Bắt đầu gửi mã hóa",
      sendingBusy: "Đang truyền dữ liệu...",
      qrTitle: "Quét mã để nhận nhanh",
      qrHint: "Mở camera điện thoại hoặc tab Nhận trên thiết bị khác để quét",
      cliCommandHint: "Hoặc nhận từ croc CLI gốc bằng lệnh:",
      sendSuccess: "Phiên truyền hoàn tất thành công 100%!",
      sendError: "Lỗi trong quá trình truyền",
    },
    receive: {
      title: "Nhận tệp & Dữ liệu",
      subtitle: "Nhập mã bí mật từ người gửi để bắt đầu bắt tay mật mã Zero-Knowledge",
      enterCodeLabel: "Mã bí mật (Codephrase)",
      codePlaceholder: "ví dụ: 4281-croc-flow-demo",
      connectBtn: "Kết nối & Nhận",
      connectingBusy: "Đang bắt tay mật mã...",
      modeAutoDetected: "Chế độ truyền tự động nhận diện:",
      offerTitle: "Yêu cầu gửi tệp đến",
      offerFilesCount: "Số lượng tệp",
      offerTotalSize: "Tổng dung lượng",
      acceptBtn: "Chấp nhận & Tải về",
      rejectBtn: "Từ chối",
      downloadingTitle: "Đang tải dữ liệu...",
      downloadSuccess: "Đã nhận và giải mã tệp thành công!",
      downloadError: "Lỗi nhận tệp",
      downloadZipBtn: "Tải toàn bộ dạng file .ZIP",
      saveFolderBtn: "Lưu thẳng vào thư mục máy",
      folderTreeTitle: "Cấu trúc thư mục nhận được",
      resumeCacheTitle: "Bộ nhớ đệm khôi phục (Resume Cache IndexedDB)",
      resumeCacheSummary: "Lưu giữ các Chunk đã xác thực SHA-256 để tiếp tục truyền khi mất mạng mà không cần tải lại từ đầu.",
      clearResumeCacheBtn: "Xóa sạch bộ nhớ đệm",
      chunksCached: "Chunk đã lưu",
      bytesCached: "Dung lượng cache",
      noCachedData: "Chưa có dữ liệu cache nào trong IndexedDB",
      previewText: "Nội dung văn bản nhận được:",
    },
    relays: {
      title: "Quản lý Cụm Relay & Mạng",
      subtitle: "Kiểm tra tình trạng mạng, đo Ping RTT thực tế và giám sát lưu lượng các Relay Node",
      profilePublic: "Relay Công cộng",
      profilePublicDesc: "Kết nối cụm relay chính thức (1..4.getcroc.com) qua Bridge Server bảo mật",
      profileLocalLab: "Phòng Lab 2 Relay Cục bộ",
      profileLocalLabDesc: "Chạy độc lập Relay Alpha & Relay Beta trên cổng cục bộ, hỗ trợ truyền Dual-Relay & Failover",
      profileCustom: "Relay Tự dựng",
      profileCustomDesc: "Kết nối tới máy chủ Relay tự host trong mạng nội bộ hoặc phòng thực hành",
      measureRttBtn: "Đo độ trễ (Ping RTT)",
      measuring: "Đang đo...",
      addCustomRelayBtn: "Thêm Relay tự dựng",
      rankTitle: "Bảng xếp hạng độ trễ RTT",
      fastestNode: "Nhanh nhất",
      latencyMs: "ms",
      bytesRelayed: "Lưu lượng",
      framesRelayed: "Gói tin",
      customModalTitle: "Cấu hình Relay Tự dựng",
      customNameLabel: "Tên hiển thị",
      customHostLabel: "Địa chỉ Host / IP",
      customPortLabel: "Cổng TCP",
      saveRelayBtn: "Lưu cấu hình",
    },
    history: {
      title: "Lịch sử & Nhóm làm việc",
      subtitle: "Quản lý danh tính thiết bị, Passphrase nhóm xoay vòng tự động và nhật ký truyền",
      deviceAliasTitle: "Tên thiết bị (Device Alias)",
      deviceAliasHint: "Tên hiển thị trên mạng để nhận diện thiết bị này trong lịch sử và danh bạ.",
      saveAliasBtn: "Lưu tên thiết bị",
      groupPassphraseTitle: "Passphrase nhóm xoay vòng theo tháng (HKDF)",
      groupPassphraseDesc: "Thống nhất 1 khóa chung trong nhóm đồ án. Mỗi tháng hệ thống tự dẫn xuất một Codephrase mới bảo mật mà các thành viên không cần gửi lại mật mã.",
      newGroupBtn: "Tạo nhóm mới",
      groupNameLabel: "Tên nhóm",
      groupSecretLabel: "Mật khẩu gốc bí mật",
      deriveCodeBtn: "Tạo mã tháng này",
      currentMonthCode: "Mã bảo mật tháng hiện tại",
      useForSendBtn: "Dùng để Gửi",
      useForReceiveBtn: "Dùng để Nhận",
      peerPresetsTitle: "Thiết bị quen thuộc (Peer Presets)",
      peerPresetsDesc: "Lưu danh sách máy bạn bè / laptop cá nhân để gửi nhanh chỉ với 1 click.",
      addPeerBtn: "Thêm thiết bị",
      peerAliasLabel: "Tên thiết bị bạn bè",
      peerNotesLabel: "Ghi chú (tùy chọn)",
      transferHistoryTitle: "Nhật ký truyền (Transfer Sessions)",
      filterAll: "Tất cả",
      filterSend: "Đã gửi",
      filterReceive: "Đã nhận",
      searchPlaceholder: "Tìm theo tên tệp hoặc codephrase...",
      clearHistoryBtn: "Xóa toàn bộ lịch sử",
      noHistoryYet: "Chưa có phiên truyền nào được ghi nhận.",
    },
    inspector: {
      title: "Bảng soi giao thức thời gian thực",
      subtitle: "Giám sát mốc bắt tay PAKE, bản đồ phân bổ Chunk và thông lượng dữ liệu theo thời gian thực",
      pakeHandshake: "Tiến trình Bắt tay Mật mã (PAKE / ECDH)",
      chunkGrid: "Bản đồ phân bổ Chunk song song",
      throughputGraph: "Đồ thị thông lượng thời gian thực",
      eventLog: "Nhật ký sự kiện chi tiết",
      exportLogBtn: "Xuất báo cáo Markdown (.md)",
      legendAlpha: "Relay Alpha (Chẵn)",
      legendBeta: "Relay Beta (Lẻ)",
      legendVerified: "Đã xác thực SHA-256",
      legendResumed: "Khôi phục từ Cache",
      legendFailover: "Failover sang Beta",
      legendPending: "Đang chờ",
    },
    docs: {
      title: "Trung tâm Đào tạo & Tài liệu Kỹ thuật",
      subtitle: "Cẩm nang Lập trình mạng từ con số 0, Kiến trúc 1-codebase và Bộ chạy Demo tương tác",
      tabNetworking: "Kiến thức Mạng Máy tính",
      tabArchitecture: "Kiến trúc Mã nguồn",
      tabDemo: "Kịch bản Demo & Vấn đáp",
      downloadsTitle: "Tải ứng dụng đa nền tảng",
      pwaTitle: "Ứng dụng Web PWA (Khuyên dùng)",
      androidTitle: "Bản cài Android (.apk)",
      desktopTitle: "Bản cài Desktop (.exe / .dmg)",
      exportReportBtn: "Xuất Báo Cáo Kỹ Thuật (.md)",
      interactiveDemoTitle: "Bộ chạy Demo Trực tiếp (1-Click Verification)",
      runFailoverDemoBtn: "Chạy Demo 2 Relay + Failover",
      runResumeDemoBtn: "Chạy Demo Resume Cache IndexedDB",
      severAlphaBtn: "Mô phỏng ngắt kết nối Relay Alpha (Failover)",
      demoRunning: "Đang chạy kịch bản trình diễn...",
      demoSuccess: "Kịch bản trình diễn hoàn thành xuất sắc!",
    },
  },
  en: {
    common: {
      appName: "CrocFlow",
      tagline: "End-to-End PAKE Encrypted File Transfer · Cross-Platform",
      loading: "Loading...",
      success: "Success",
      error: "An error occurred",
      cancel: "Cancel",
      confirm: "Confirm",
      copy: "Copy",
      copied: "Copied!",
      save: "Save",
      saved: "Saved!",
      delete: "Delete",
      clear: "Clear",
      refresh: "Refresh",
      close: "Close",
      open: "Open",
      all: "All",
      bytes: "Size",
      speed: "Speed",
      eta: "ETA",
      status: "Status",
      actions: "Actions",
      online: "Online",
      offline: "Offline",
      connected: "Connected",
      disconnected: "Disconnected",
      active: "Active",
      idle: "Idle",
      themeLight: "Light Theme",
      themeDark: "Dark Theme",
      language: "Language",
      vietnamese: "Tiếng Việt",
      english: "English",
      switchLang: "Chuyển sang Tiếng Việt",
      installed: "Installed",
      installApp: "Install App",
    },
    nav: {
      send: "Send Files & Folders",
      sendShort: "Send",
      sendSummary: "Send files, complete folders, or secure text with PAKE codephrases and instant QR codes.",
      receive: "Receive & Resume",
      receiveShort: "Receive",
      receiveSummary: "Receive via codephrase from CrocFlow, croc CLI, or getcroc.com with IndexedDB resume support.",
      relays: "Relays & Network",
      relaysShort: "Relays",
      relaysSummary: "Monitor public Croc relays, benchmark RTT latency, and operate local dual-relay lab.",
      history: "History & Groups",
      historyShort: "History",
      historySummary: "Browse past transfer sessions, manage device alias, and rotate monthly group passphrases.",
      docs: "Downloads & Docs Hub",
      docsShort: "Docs",
      docsSummary: "Install cross-platform builds, run interactive demo scripts, and study networking guides.",
      protocolInspector: "Protocol Inspector",
      hideInspector: "Hide Inspector",
      showInspector: "Inspect Protocol",
    },
    send: {
      title: "Secure File & Data Transfer",
      subtitle: "End-to-end PAKE v2 encryption · 100% croc CLI interoperable · Dual-Relay streaming",
      modeStandardTitle: "Standard Croc v11",
      modeStandardDesc: "100% wire-compatible with croc CLI & getcroc.com (PAKE P-256 + AES-GCM)",
      modeEnhancedTitle: "Enhanced CrocFlow",
      modeEnhancedDesc: "Full folders · SHA-256 chunks · Concurrent Dual-Relay · IndexedDB resume",
      fileTab: "Files",
      folderTab: "Folder",
      textTab: "Secure Text",
      dragDropText: "Drag & drop files here, or",
      dragDropFolderText: "Drag & drop a folder here, or",
      browseFiles: "Browse Files",
      browseFolders: "Browse Folder",
      selectedCount: "files selected",
      totalSize: "Total size",
      clearFiles: "Clear selection",
      textPlaceholder: "Enter sensitive notes or text payload to transfer securely...",
      textCharCount: "characters",
      secretPhrase: "Secret Codephrase",
      regeneratePhrase: "Generate New Code",
      phraseHint: "The recipient only needs this codephrase or the QR code to receive the payload",
      optionsTitle: "Advanced Options",
      dualRelayTitle: "Concurrent Dual-Relay Transfer (Alpha + Beta)",
      dualRelayDesc: "Splits even chunks via Relay Alpha and odd chunks via Relay Beta. Automatic failover upon disconnection.",
      fastestRelayTitle: "Target Fastest Relay (Lowest RTT)",
      fastestRelayDesc: "Optimizes the codephrase hash to match the public relay with the lowest latency.",
      chunkSizeLabel: "Chunk Size",
      frequentPeersTitle: "Quick send to saved peers",
      quickSendTo: "Send to",
      startSendBtn: "Start Encrypted Transfer",
      sendingBusy: "Transferring payload...",
      qrTitle: "Scan QR to Receive",
      qrHint: "Scan with a mobile camera or another device running CrocFlow",
      cliCommandHint: "Or receive via official croc CLI with:",
      sendSuccess: "Transfer completed successfully 100%!",
      sendError: "Error encountered during transfer",
    },
    receive: {
      title: "Receive Files & Payload",
      subtitle: "Enter the sender's codephrase to start zero-knowledge cryptographic handshake",
      enterCodeLabel: "Secret Codephrase",
      codePlaceholder: "e.g., 4281-croc-flow-demo",
      connectBtn: "Connect & Receive",
      connectingBusy: "Cryptographic handshake in progress...",
      modeAutoDetected: "Auto-detected protocol mode:",
      offerTitle: "Incoming Transfer Offer",
      offerFilesCount: "File count",
      offerTotalSize: "Total payload size",
      acceptBtn: "Accept & Download",
      rejectBtn: "Decline",
      downloadingTitle: "Receiving payload...",
      downloadSuccess: "Payload received and verified successfully!",
      downloadError: "Error receiving payload",
      downloadZipBtn: "Download Entire Folder as .ZIP",
      saveFolderBtn: "Save Directly to Directory",
      folderTreeTitle: "Received Folder Structure",
      resumeCacheTitle: "IndexedDB Resume Cache",
      resumeCacheSummary: "Stores verified SHA-256 chunks locally so interrupted transfers can resume without re-downloading.",
      clearResumeCacheBtn: "Purge Resume Cache",
      chunksCached: "Cached chunks",
      bytesCached: "Cached size",
      noCachedData: "No cached chunks found in IndexedDB",
      previewText: "Received text content:",
    },
    relays: {
      title: "Relay Cluster & Network Hub",
      subtitle: "Monitor network health, benchmark real RTT latency, and inspect relay node traffic",
      profilePublic: "Public Relays",
      profilePublicDesc: "Connect to official Croc relays (1..4.getcroc.com) via secure allowlisted bridge",
      profileLocalLab: "Local Dual-Relay Lab",
      profileLocalLabDesc: "Run independent Alpha & Beta relays locally with dual-stream failover support",
      profileCustom: "Custom Relay",
      profileCustomDesc: "Connect to your own self-hosted relay inside a local lab or private subnet",
      measureRttBtn: "Measure Latency (Ping RTT)",
      measuring: "Probing...",
      addCustomRelayBtn: "Add Custom Relay",
      rankTitle: "RTT Latency Leaderboard",
      fastestNode: "Fastest",
      latencyMs: "ms",
      bytesRelayed: "Traffic",
      framesRelayed: "Packets",
      customModalTitle: "Configure Custom Relay",
      customNameLabel: "Display Name",
      customHostLabel: "Host / IP Address",
      customPortLabel: "TCP Port",
      saveRelayBtn: "Save Relay",
    },
    history: {
      title: "History & Collaboration Groups",
      subtitle: "Manage device identity, monthly rotating group secrets, and transfer audit logs",
      deviceAliasTitle: "Device Friendly Name (Alias)",
      deviceAliasHint: "Identifies this device across transfer history and peer address books.",
      saveAliasBtn: "Save Alias",
      groupPassphraseTitle: "Monthly Rotating Group Passphrase (HKDF)",
      groupPassphraseDesc: "Agree on one shared group secret. Each calendar month automatically derives a fresh, secure codephrase without needing to transmit new secrets.",
      newGroupBtn: "Create Group",
      groupNameLabel: "Group Name",
      groupSecretLabel: "Shared Master Secret",
      deriveCodeBtn: "Derive Monthly Code",
      currentMonthCode: "Active Code for Current Month",
      useForSendBtn: "Use to Send",
      useForReceiveBtn: "Use to Receive",
      peerPresetsTitle: "Frequent Peer Presets",
      peerPresetsDesc: "Save recurring collaborator devices for quick 1-click dispatch.",
      addPeerBtn: "Add Peer",
      peerAliasLabel: "Peer Alias",
      peerNotesLabel: "Notes (Optional)",
      transferHistoryTitle: "Transfer Session Log",
      filterAll: "All",
      filterSend: "Sent",
      filterReceive: "Received",
      searchPlaceholder: "Search by filename or codephrase...",
      clearHistoryBtn: "Clear Entire History",
      noHistoryYet: "No transfer sessions recorded yet.",
    },
    inspector: {
      title: "Real-Time Protocol Inspector",
      subtitle: "Monitor live cryptographic handshake milestones, chunk distribution, and throughput",
      pakeHandshake: "PAKE / ECDH Handshake Milestones",
      chunkGrid: "Concurrent Chunk Distribution Matrix",
      throughputGraph: "Real-Time Throughput Graph",
      eventLog: "Detailed Event Stream",
      exportLogBtn: "Export Markdown Log (.md)",
      legendAlpha: "Relay Alpha (Even)",
      legendBeta: "Relay Beta (Odd)",
      legendVerified: "Verified SHA-256",
      legendResumed: "Cached from Resume DB",
      legendFailover: "Failover to Beta",
      legendPending: "Pending",
    },
    docs: {
      title: "Learning Center & Technical Documentation",
      subtitle: "Networking fundamentals from zero to hero, 1-codebase architecture, and interactive demo testbed",
      tabNetworking: "Computer Networking Guide",
      tabArchitecture: "Codebase Architecture",
      tabDemo: "Interactive Demo & Evaluation",
      downloadsTitle: "Cross-Platform Downloads",
      pwaTitle: "Progressive Web App (Recommended)",
      androidTitle: "Android Package (.apk)",
      desktopTitle: "Desktop Package (.exe / .dmg)",
      exportReportBtn: "Export Technical Evaluation Report (.md)",
      interactiveDemoTitle: "Interactive Live Demo Runners (1-Click Verification)",
      runFailoverDemoBtn: "Run 2-Relay + Failover Demo",
      runResumeDemoBtn: "Run IndexedDB Resume Demo",
      severAlphaBtn: "Simulate Relay Alpha Outage (Failover)",
      demoRunning: "Running live demonstration...",
      demoSuccess: "Live demonstration completed successfully!",
    },
  },
};

const STORAGE_KEY = "crocflow-locale";

/**
 * Resolves the initial locale:
 * 1. Checks localStorage for a previously saved preference ('vi' or 'en').
 * 2. If absent, checks browser languages (navigator.languages / navigator.language).
 * 3. Defaults to 'vi' for Vietnamese or 'en' for English.
 */
export function resolveInitialLocale(storage: Storage | null = null): Locale {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    if (saved === "vi" || saved === "en") {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }

  if (typeof navigator !== "undefined") {
    const lang = (navigator.language || "").toLowerCase();
    if (lang.startsWith("vi")) {
      return "vi";
    }
  }

  return "vi";
}

/**
 * Persists user locale choice to localStorage.
 */
export function persistLocale(locale: Locale, storage: Storage | null = null): void {
  try {
    storage?.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore storage quota/permission errors
  }
}

/**
 * Returns translations for the given locale.
 */
export function getTranslations(locale: Locale): Translations {
  return DICTIONARY[locale] ?? DICTIONARY.vi;
}
