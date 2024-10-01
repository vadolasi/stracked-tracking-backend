import { Cluster } from "puppeteer-cluster";
import { WebsiteSnapshot } from "./schema";

const args = [
  "--autoplay-policy=user-gesture-required",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-client-side-phishing-detection",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-dev-shm-usage",
  "--disable-domain-reliability",
  "--disable-extensions",
  "--disable-features=AudioServiceOutOfProcess",
  "--disable-hang-monitor",
  "--disable-ipc-flooding-protection",
  "--disable-notifications",
  "--disable-offer-store-unmasked-wallet-cards",
  "--disable-popup-blocking",
  "--disable-print-preview",
  "--disable-prompt-on-repost",
  "--disable-renderer-backgrounding",
  "--disable-setuid-sandbox",
  "--disable-speech-api",
  "--disable-sync",
  "--hide-scrollbars",
  "--ignore-gpu-blacklist",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-default-browser-check",
  "--no-first-run",
  "--no-pings",
  "--no-sandbox",
  "--no-zygote",
  "--password-store=basic",
  "--use-gl=swiftshader",
  "--use-mock-keychain",
  "--disable-accelerated-2d-canvas",
  "--disable-gpu"
]  

function getXPath(element: Element): { selector: string; coordinates: { top: number; left: number; bottom: number; right: number } } {
  let selector = "";
  let foundRoot: boolean;
  let currentElement = element;

  do {
    const tagName = currentElement.tagName.toLowerCase();
    const parentElement = currentElement.parentElement;

    if (!parentElement) {
      selector = `/${tagName}${selector}`;
      break;
    }

    if (parentElement.childElementCount > 1) {
      const parentsChildren = [...parentElement!.children];

      let tag: Element[] = [];
      parentsChildren.forEach(child => {
        if (child.tagName.toLowerCase() === tagName) tag.push(child)
      })

      if (tag.length === 1) {
        selector = `/${tagName}${selector}`;
      } else {
        const position = tag.indexOf(currentElement) + 1;
        selector = `/${tagName}[${position}]${selector}`;
      }
    } else {
      selector = `/${tagName}${selector}`;
    }

    currentElement = parentElement;
    foundRoot = parentElement.tagName.toLowerCase() === "html";
    if (foundRoot) selector = `/html${selector}`;
  } while (foundRoot === false);

  const { top, left, bottom, right } = element.getBoundingClientRect();

  return {
    selector,
    coordinates: {
      top,
      left,
      bottom,
      right,
    },
  };
}

(async () => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 4,
    puppeteerOptions: {
      args,
    },
  });

  await cluster.task(async ({ page, data: url }) => {
    await page.goto(url);
    await page.setViewport({ width: 1280, height: 720 });
    const screenshot = await page.screenshot({ fullPage: true, type: "webp", quality: 100 });

    const elements = await page.$$("*");

    const elementsData: { selector: string; coordinates: { top: number; left: number; bottom: number; right: number } }[] = [];

    for (const element of elements) {
      elementsData.push(await page.evaluate(getXPath, element));
    }

    const websiteSnapshot = new WebsiteSnapshot({
      websiteUuid: "af9050e2-df49-41de-94a7-457c84a314c9",
      snapshot: elementsData,
      screenshot: Buffer.from(screenshot),
    });

    await websiteSnapshot.save();
  });

  cluster.queue("http://localhost:4000");

  await cluster.idle();
  await cluster.close();
})();
