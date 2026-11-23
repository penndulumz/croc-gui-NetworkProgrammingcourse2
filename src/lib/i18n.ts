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
    cancelBtn: string;
    simulateFailoverBtn: string;
    switchRelayBtn: string;
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
    bridgeOriginTitle: string;
    bridgeOriginDesc: string;
    bridgeOriginLabel: string;
    bridgeOriginSaveBtn: string;
    bridgeOriginTestBtn: string;
    bridgeOriginClearBtn: string;
    bridgeOriginNativeNotice: string;
    bridgeOriginSameOrigin: string;
    bridgeOriginActive: string;
    bridgeOriginInvalid: string;
    bridgeOriginTesting: string;
    bridgeOriginTestOk: string;
    bridgeOriginTestFail: string;
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
  modeSelector: {
    ariaLabel: string;
    standardTab: string;
    enhancedTab: string;
    compareTitle: string;
    standardTitle: string;
    standardPoint1: string;
    standardPoint2: string;
    standardPoint3: string;
    enhancedTitle: string;
    enhancedPoint1: string;
    enhancedPoint2: string;
    enhancedPoint3: string;
    understoodBtn: string;
    compareBtnTitle: string;
    closeBtn: string;
  };
  streamInspector: {
    toggleBtn: string;
    relayAlpha: string;
    relayBeta: string;
    evenChunks: string;
    oddChunks: string;
    failover: string;
    failoverRerouted: string;
    resumeDb: string;
    cachedSkip: string;
    rttLabel: string;
    statusNormal: string;
    statusSevered: string;
  };
  relayProfile: {
    activeLabel: string;
    localLabTitle: string;
    publicRelaysTitle: string;
    switchBtn: string;
    switchToLocalTitle: string;
    switchToPublicTitle: string;
    standardLocalNoticeTitle: string;
    standardLocalNoticeBody: string;
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
      browseFiles: "Chọn tệp",
      browseFolders: "Chọn thư mục",
      selectedCount: "tệp đã chọn",
      totalSize: "Tổng dung lượng",
      clearFiles: "Xóa hết",
      textPlaceholder: "Nhập tin nhắn hoặc văn bản mật cần truyền trực tiếp...",
      textCharCount: "ký tự",
      secretPhrase: "Mã bí mật (Codephrase)",
      regeneratePhrase: "Mã mới",
      phraseHint: "Người nhận chỉ cần nhập mã này hoặc quét QR code để bắt đầu truyền",
      optionsTitle: "Tùy chọn nâng cao",
      dualRelayTitle: "Truyền song song 2 Relay (Alpha + Beta)",
      dualRelayDesc: "Chia chunk chẵn qua Relay Alpha, chunk lẻ qua Relay Beta. Tự động Failover nếu 1 relay mất mạng.",
      fastestRelayTitle: "Tự chọn Relay nhanh nhất (Thấp Ping)",
      fastestRelayDesc: "Tối ưu mã codephrase khớp với relay công cộng có độ trễ RTT thấp nhất.",
      chunkSizeLabel: "Kích thước Chunk",
      frequentPeersTitle: "Gửi nhanh tới thiết bị quen thuộc",
      quickSendTo: "Gửi tới",
      startSendBtn: "Gửi tệp",
      sendingBusy: "Đang gửi...",
      cancelBtn: "Hủy",
      simulateFailoverBtn: "Mô phỏng ngắt",
      switchRelayBtn: "Đổi Relay",
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
      connectBtn: "Nhận tệp",
      connectingBusy: "Đang nhận...",
      modeAutoDetected: "Chế độ truyền tự động nhận diện:",
      offerTitle: "Yêu cầu gửi tệp đến",
      offerFilesCount: "Số lượng tệp",
      offerTotalSize: "Tổng dung lượng",
      acceptBtn: "Chấp nhận",
      rejectBtn: "Từ chối",
      downloadingTitle: "Đang tải dữ liệu...",
      downloadSuccess: "Đã nhận và giải mã tệp thành công!",
      downloadError: "Lỗi nhận tệp",
      downloadZipBtn: "Tải ZIP",
      saveFolderBtn: "Lưu thư mục",
      folderTreeTitle: "Cấu trúc thư mục nhận được",
      resumeCacheTitle: "Bộ nhớ đệm khôi phục (Resume Cache IndexedDB)",
      resumeCacheSummary: "Lưu giữ các Chunk đã xác thực SHA-256 để tiếp tục truyền khi mất mạng mà không cần tải lại từ đầu.",
      clearResumeCacheBtn: "Xóa đệm",
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
      measureRttBtn: "Đo Ping",
      measuring: "Đang đo...",
      addCustomRelayBtn: "Thêm Relay",
      rankTitle: "Bảng xếp hạng độ trễ RTT",
      fastestNode: "Nhanh nhất",
      latencyMs: "ms",
      bytesRelayed: "Lưu lượng",
      framesRelayed: "Gói tin",
      customModalTitle: "Cấu hình Relay Tự dựng",
      customNameLabel: "Tên hiển thị",
      customHostLabel: "Địa chỉ Host / IP",
      customPortLabel: "Cổng TCP",
      saveRelayBtn: "Lưu Relay",
      bridgeOriginTitle: "Địa chỉ Bridge Server",
      bridgeOriginDesc: "Ứng dụng Android (APK) không có Bridge Server bên trong. Nhập địa chỉ máy tính đang chạy CrocFlow server trong cùng mạng LAN, ví dụ http://192.168.1.10:3000.",
      bridgeOriginLabel: "Địa chỉ (origin)",
      bridgeOriginSaveBtn: "Lưu",
      bridgeOriginTestBtn: "Kiểm tra",
      bridgeOriginClearBtn: "Xóa",
      bridgeOriginNativeNotice: "Đang chạy trong ứng dụng Android nhưng chưa cấu hình Bridge Server. Hãy chạy CrocFlow server trên máy tính cùng mạng LAN và nhập địa chỉ bên dưới để gửi/nhận tệp.",
      bridgeOriginSameOrigin: "Đang dùng Bridge Server phục vụ trang này",
      bridgeOriginActive: "Đang dùng Bridge Server",
      bridgeOriginInvalid: "Địa chỉ không hợp lệ. Dùng dạng http://IP:cổng, ví dụ http://192.168.1.10:3000.",
      bridgeOriginTesting: "Đang kiểm tra...",
      bridgeOriginTestOk: "Bridge Server phản hồi /healthz thành công",
      bridgeOriginTestFail: "Không kết nối được Bridge Server",
    },
    history: {
      title: "Lịch sử & Nhóm làm việc",
      subtitle: "Quản lý danh tính thiết bị, Passphrase nhóm xoay vòng tự động và nhật ký truyền",
      deviceAliasTitle: "Tên thiết bị (Device Alias)",
      deviceAliasHint: "Tên hiển thị trên mạng để nhận diện thiết bị này trong lịch sử và danh bạ.",
      saveAliasBtn: "Lưu tên",
      groupPassphraseTitle: "Passphrase nhóm xoay vòng theo tháng (HKDF)",
      groupPassphraseDesc: "Thống nhất 1 khóa chung trong nhóm đồ án. Mỗi tháng hệ thống tự dẫn xuất một Codephrase mới bảo mật mà các thành viên không cần gửi lại mật mã.",
      newGroupBtn: "Tạo nhóm",
      groupNameLabel: "Tên nhóm",
      groupSecretLabel: "Mật khẩu gốc bí mật",
      deriveCodeBtn: "Tạo mã",
      currentMonthCode: "Mã bảo mật tháng hiện tại",
      useForSendBtn: "Dùng gửi",
      useForReceiveBtn: "Dùng nhận",
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
      clearHistoryBtn: "Xóa lịch sử",
      noHistoryYet: "Chưa có phiên truyền nào được ghi nhận.",
    },
    inspector: {
      title: "Bảng soi giao thức thời gian thực",
      subtitle: "Giám sát mốc bắt tay PAKE, bản đồ phân bổ Chunk và thông lượng dữ liệu theo thời gian thực",
      pakeHandshake: "Tiến trình Bắt tay Mật mã (PAKE / ECDH)",
      chunkGrid: "Bản đồ phân bổ Chunk song song",
      throughputGraph: "Đồ thị thông lượng thời gian thực",
      eventLog: "Nhật ký sự kiện chi tiết",
      exportLogBtn: "Xuất báo cáo",
      legendAlpha: "Relay Alpha (Chẵn)",
      legendBeta: "Relay Beta (Lẻ)",
      legendVerified: "Đã xác thực SHA-256",
      legendResumed: "Khôi phục từ Cache",
      legendFailover: "Failover sang Beta",
      legendPending: "Đang chờ",
    },
    docs: {
      title: "Trung tâm Đào tạo & Tài liệu Kỹ thuật",
      subtitle: "Cẩm nang Lập trình mạng, Kiến trúc 1-codebase và Bộ chạy Demo tương tác",
      tabNetworking: "Kiến thức Mạng",
      tabArchitecture: "Kiến trúc Mã nguồn",
      tabDemo: "Kịch bản Demo",
      downloadsTitle: "Tải ứng dụng đa nền tảng",
      pwaTitle: "Ứng dụng Web PWA (Khuyên dùng)",
      androidTitle: "Bản cài Android (.apk)",
      desktopTitle: "Bản cài Desktop (.exe / .dmg)",
      exportReportBtn: "Tải báo cáo",
      interactiveDemoTitle: "Bộ chạy Demo Trực tiếp",
      runFailoverDemoBtn: "Chạy Failover",
      runResumeDemoBtn: "Chạy Resume",
      severAlphaBtn: "Ngắt Alpha",
      demoRunning: "Đang chạy kịch bản...",
      demoSuccess: "Kịch bản hoàn thành!",
    },
    modeSelector: {
      ariaLabel: "Chế độ giao thức",
      standardTab: "Chuẩn Croc v11",
      enhancedTab: "Nâng cao CrocFlow",
      compareTitle: "So Sánh Hai Chế Độ Truyền",
      standardTitle: "Chuẩn Croc v11 (Tương thích CLI)",
      standardPoint1: "Tương thích 100% với croc CLI chính thức và getcroc.com.",
      standardPoint2: "Bắt tay mật mã PAKE P-256 + mã hóa đối xứng AES-GCM qua một luồng duy nhất.",
      standardPoint3: "Phù hợp khi gửi/nhận với máy chủ dòng lệnh hoặc thiết bị không cài CrocFlow.",
      enhancedTitle: "Nâng cao CrocFlow (2 Relay + Resume)",
      enhancedPoint1: "Truyền song song 2 Relay: Chunk chẵn qua Relay Alpha, chunk lẻ qua Relay Beta để tối đa hóa băng thông.",
      enhancedPoint2: "Tự động Failover: Khi Relay Alpha ngắt kết nối, các chunk còn lại lập tức chuyển sang Relay Beta.",
      enhancedPoint3: "Tiếp tục từ Resume Cache IndexedDB: Bỏ qua các chunk SHA-256 đã nhận khi mạng bị đứt.",
      understoodBtn: "Đã hiểu",
      compareBtnTitle: "So sánh hai chế độ truyền",
      closeBtn: "Đóng",
    },
    streamInspector: {
      toggleBtn: "Chi tiết luồng",
      relayAlpha: "Relay Alpha",
      relayBeta: "Relay Beta",
      evenChunks: "Chunk chẵn",
      oddChunks: "Chunk lẻ",
      failover: "Failover",
      failoverRerouted: "Đã chuyển tuyến",
      resumeDb: "Resume DB",
      cachedSkip: "Đã có sẵn",
      rttLabel: "RTT",
      statusNormal: "Bình thường",
      statusSevered: "Đã ngắt kết nối",
    },
    relayProfile: {
      activeLabel: "Hồ sơ Relay:",
      localLabTitle: "Local Dual-Relay Lab (Offline/LAN)",
      publicRelaysTitle: "Public Croc Relays",
      switchBtn: "Đổi Relay",
      switchToLocalTitle: "Đổi sang Local Dual-Relay Lab",
      switchToPublicTitle: "Đổi sang Public Croc Relays",
      standardLocalNoticeTitle: "Lưu ý khi dùng Chuẩn Croc v11 với Local Dual-Relay Lab:",
      standardLocalNoticeBody: "Chế độ Nâng cao (Enhanced Mode) được tối ưu hóa cho Local Dual-Relay Lab qua /ws-dual (hoạt động offline/LAN hoàn toàn không cần mở cổng TCP ra internet). Với Chuẩn Croc v11, kết nối sẽ đi qua Bridge cục bộ nhưng vẫn phụ thuộc vào cổng TCP của relay. Khuyên dùng Nâng cao CrocFlow để có trải nghiệm tối ưu trong phòng lab offline.",
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
      clearFiles: "Clear All",
      textPlaceholder: "Enter sensitive notes or text payload to transfer securely...",
      textCharCount: "characters",
      secretPhrase: "Secret Codephrase",
      regeneratePhrase: "New Code",
      phraseHint: "The recipient only needs this codephrase or the QR code to receive the payload",
      optionsTitle: "Advanced Options",
      dualRelayTitle: "Concurrent Dual-Relay Transfer (Alpha + Beta)",
      dualRelayDesc: "Splits even chunks via Relay Alpha and odd chunks via Relay Beta. Automatic failover upon disconnection.",
      fastestRelayTitle: "Target Fastest Relay (Lowest RTT)",
      fastestRelayDesc: "Optimizes the codephrase hash to match the public relay with the lowest latency.",
      chunkSizeLabel: "Chunk Size",
      frequentPeersTitle: "Quick send to saved peers",
      quickSendTo: "Send to",
      startSendBtn: "Send",
      sendingBusy: "Sending...",
      cancelBtn: "Cancel",
      simulateFailoverBtn: "Test Failover",
      switchRelayBtn: "Switch Relay",
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
      connectBtn: "Receive",
      connectingBusy: "Connecting...",
      modeAutoDetected: "Auto-detected protocol mode:",
      offerTitle: "Incoming Transfer Offer",
      offerFilesCount: "File count",
      offerTotalSize: "Total payload size",
      acceptBtn: "Accept",
      rejectBtn: "Decline",
      downloadingTitle: "Receiving payload...",
      downloadSuccess: "Payload received and verified successfully!",
      downloadError: "Error receiving payload",
      downloadZipBtn: "Download ZIP",
      saveFolderBtn: "Save Folder",
      folderTreeTitle: "Received Folder Structure",
      resumeCacheTitle: "IndexedDB Resume Cache",
      resumeCacheSummary: "Stores verified SHA-256 chunks locally so interrupted transfers can resume without re-downloading.",
      clearResumeCacheBtn: "Clear Cache",
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
      measureRttBtn: "Test Ping",
      measuring: "Testing...",
      addCustomRelayBtn: "Add Relay",
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
      bridgeOriginTitle: "Bridge Server Address",
      bridgeOriginDesc: "The Android app (APK) has no Bridge Server inside. Enter the address of a computer running the CrocFlow server on the same LAN, e.g. http://192.168.1.10:3000.",
      bridgeOriginLabel: "Address (origin)",
      bridgeOriginSaveBtn: "Save",
      bridgeOriginTestBtn: "Test",
      bridgeOriginClearBtn: "Clear",
      bridgeOriginNativeNotice: "Running inside the Android app with no Bridge Server configured. Start the CrocFlow server on a computer on the same LAN and enter its address below to send or receive files.",
      bridgeOriginSameOrigin: "Using the Bridge Server that serves this page",
      bridgeOriginActive: "Using Bridge Server",
      bridgeOriginInvalid: "Invalid address. Use http://IP:port, e.g. http://192.168.1.10:3000.",
      bridgeOriginTesting: "Testing...",
      bridgeOriginTestOk: "Bridge Server answered /healthz",
      bridgeOriginTestFail: "Could not reach the Bridge Server",
    },
    history: {
      title: "History & Collaboration Groups",
      subtitle: "Manage device identity, monthly rotating group secrets, and transfer audit logs",
      deviceAliasTitle: "Device Friendly Name (Alias)",
      deviceAliasHint: "Identifies this device across transfer history and peer address books.",
      saveAliasBtn: "Save Alias",
      groupPassphraseTitle: "Monthly Rotating Group Passphrase (HKDF)",
      groupPassphraseDesc: "Agree on one shared group secret. Each calendar month automatically derives a fresh, secure codephrase without needing to transmit new secrets.",
      newGroupBtn: "New Group",
      groupNameLabel: "Group Name",
      groupSecretLabel: "Shared Master Secret",
      deriveCodeBtn: "Generate Code",
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
      clearHistoryBtn: "Clear History",
      noHistoryYet: "No transfer sessions recorded yet.",
    },
    inspector: {
      title: "Real-Time Protocol Inspector",
      subtitle: "Monitor live cryptographic handshake milestones, chunk distribution, and throughput",
      pakeHandshake: "PAKE / ECDH Handshake Milestones",
      chunkGrid: "Concurrent Chunk Distribution Matrix",
      throughputGraph: "Live Throughput Graph",
      eventLog: "Detailed Event Stream",
      exportLogBtn: "Export Log",
      legendAlpha: "Relay Alpha (Even)",
      legendBeta: "Relay Beta (Odd)",
      legendVerified: "Verified SHA-256",
      legendResumed: "Cached from Resume DB",
      legendFailover: "Failover to Beta",
      legendPending: "Pending",
    },
    docs: {
      title: "Developer Hub & Technical Documentation",
      subtitle: "Networking fundamentals, 1-codebase architecture, and interactive demo testbed",
      tabNetworking: "Networking Guide",
      tabArchitecture: "Codebase Architecture",
      tabDemo: "Evaluation & Demo",
      downloadsTitle: "Cross-Platform Downloads",
      pwaTitle: "Progressive Web App (Recommended)",
      androidTitle: "Android Package (.apk)",
      desktopTitle: "Desktop Package (.exe / .dmg)",
      exportReportBtn: "Export Report",
      interactiveDemoTitle: "Interactive Live Demo Runners",
      runFailoverDemoBtn: "Run Failover",
      runResumeDemoBtn: "Run Resume",
      severAlphaBtn: "Sever Alpha",
      demoRunning: "Running live demonstration...",
      demoSuccess: "Live demonstration completed successfully!",
    },
    modeSelector: {
      ariaLabel: "Protocol mode",
      standardTab: "Standard (Croc v11)",
      enhancedTab: "Enhanced (CrocFlow)",
      compareTitle: "Transfer Protocol Comparison",
      standardTitle: "Standard Croc v11 (CLI Compatible)",
      standardPoint1: "100% interoperable with official croc CLI and getcroc.com.",
      standardPoint2: "PAKE P-256 cryptographic handshake + AES-GCM single stream.",
      standardPoint3: "Ideal for terminal users or systems running upstream Go CLI.",
      enhancedTitle: "Enhanced CrocFlow (Dual-Relay + Resume)",
      enhancedPoint1: "Concurrent Dual-Relay: Even chunks on Relay Alpha, odd chunks on Relay Beta for multiplexed bandwidth.",
      enhancedPoint2: "Active Failover: If Relay Alpha disconnects, in-flight chunks dynamically migrate to Relay Beta.",
      enhancedPoint3: "Delta Resume via IndexedDB: Skips verified SHA-256 chunks after reconnecting.",
      understoodBtn: "Got it",
      compareBtnTitle: "Compare protocol modes",
      closeBtn: "Close",
    },
    streamInspector: {
      toggleBtn: "Stream Stats",
      relayAlpha: "Relay Alpha",
      relayBeta: "Relay Beta",
      evenChunks: "Even chunks",
      oddChunks: "Odd chunks",
      failover: "Failover",
      failoverRerouted: "Rerouted",
      resumeDb: "Resume DB",
      cachedSkip: "Cached skip",
      rttLabel: "RTT",
      statusNormal: "Normal",
      statusSevered: "Severed",
    },
    relayProfile: {
      activeLabel: "Relay Profile:",
      localLabTitle: "Local Dual-Relay Lab (Offline/LAN)",
      publicRelaysTitle: "Public Croc Relays",
      switchBtn: "Switch Relay",
      switchToLocalTitle: "Switch to Local Dual-Relay Lab",
      switchToPublicTitle: "Switch to Public Croc Relays",
      standardLocalNoticeTitle: "Notice when using Standard Croc v11 with Local Dual-Relay Lab:",
      standardLocalNoticeBody: "Enhanced Mode is optimized for the Local Dual-Relay Lab via /ws-dual (operating completely offline/LAN without requiring internet TCP exposure). Under Standard Croc v11, traffic routes through the local bridge but remains dependent on relay TCP port forwarding. Enhanced CrocFlow is recommended for offline lab environments.",
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
