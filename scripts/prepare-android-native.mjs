import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidRoot = path.join(root, "android");
const javaRoot = path.join(androidRoot, "app", "src", "main", "java");
const wrapperPropertiesPath = path.join(androidRoot, "gradle", "wrapper", "gradle-wrapper.properties");
const wrapperProperties = await readFile(wrapperPropertiesPath, "utf8");
const compatibleWrapperProperties = wrapperProperties.replace(
  /distributionUrl=.*gradle-[\d.]+-bin\.zip/,
  "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip",
);
if (compatibleWrapperProperties === wrapperProperties && !wrapperProperties.includes("gradle-8.14.3-bin.zip")) {
  throw new Error("Could not set the Android-compatible Gradle wrapper version");
}
if (compatibleWrapperProperties !== wrapperProperties) {
  await writeFile(wrapperPropertiesPath, compatibleWrapperProperties);
}

async function findMainActivity(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = await findMainActivity(target);
      if (found) return found;
    } else if (entry.name === "MainActivity.java") {
      return target;
    }
  }
  return null;
}

const activityPath = await findMainActivity(javaRoot);
if (!activityPath) throw new Error("Capacitor MainActivity.java was not found");

let activity = await readFile(activityPath, "utf8");
const packageName = activity.match(/^package\s+([\w.]+);/m)?.[1];
if (!packageName) throw new Error("Could not read the Android package from MainActivity.java");

const bridgeTemplate = await readFile(path.join(root, "native", "android", "CrocDirectTcpBridge.java"), "utf8");
const bridgeSource = bridgeTemplate.replace(/^package\s+[^;]+;/m, `package ${packageName};`);
await writeFile(path.join(path.dirname(activityPath), "CrocDirectTcpBridge.java"), bridgeSource);

if (!activity.includes("CrocDirectTcpBridge")) {
  const classPattern = /(public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{)/;
  if (!classPattern.test(activity)) throw new Error("Could not locate the generated MainActivity class declaration");
  activity = activity.replace(classPattern, `$1\n  @Override\n  public void onCreate(android.os.Bundle savedInstanceState) {\n    super.onCreate(savedInstanceState);\n    getBridge().getWebView().addJavascriptInterface(new CrocDirectTcpBridge(getBridge().getWebView()), "CrocDirectTcp");\n  }`);
  await writeFile(activityPath, activity);
}

console.log("Installed CrocFlow Android direct TCP transport.");
