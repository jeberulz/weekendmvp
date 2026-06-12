import Script from "next/script";

/**
 * Animated WebGL aura backdrop ported verbatim from the legacy
 * "Background (component) added by Aura" block (UnicornStudio embed).
 * Render once near the top of a page wrapper; the loader script guards
 * against double-initialization.
 */
const UNICORN_STUDIO_LOADER = `!function(){if(!window.UnicornStudio){window.UnicornStudio={isInitialized:!1};var i=document.createElement("script");i.src="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js",i.onload=function(){window.UnicornStudio.isInitialized||(UnicornStudio.init(),window.UnicornStudio.isInitialized=!0)},(document.head || document.body).appendChild(i)}}();`;

export function AuraBackground() {
  return (
    <>
      <div
        className="aura-background-component top-0 w-full h-screen -z-10 absolute"
        data-alpha-mask="80"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 0%, black 80%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 0%, black 80%, transparent)",
        }}
      >
        <div className="aura-background-component top-0 w-full -z-10 absolute h-full">
          <div
            data-us-project="ILgOO23w4wEyPQOKyLO4"
            className="absolute w-full h-full left-0 top-0 -z-10"
          />
        </div>
      </div>
      <Script id="unicorn-studio-loader" strategy="afterInteractive">
        {UNICORN_STUDIO_LOADER}
      </Script>
    </>
  );
}
