import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("crocflowDesktop", {
  platform: process.platform,
  isDesktopApp: true,
});
