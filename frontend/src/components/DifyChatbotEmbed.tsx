import { useEffect } from 'react';

const DEFAULT_DIFY_TOKEN = 'bkCgWSXgSyNhDsZ8';
const DEFAULT_DIFY_BASE_URL = 'http://192.168.122.193:8090';

const BUTTON_ID = 'dify-chatbot-bubble-button';
const IFRAME_ID = 'dify-chatbot-bubble-window';

type DifyChatbotConfig = {
  token: string;
  baseUrl: string;
  dynamicScript: boolean;
  inputs: Record<string, unknown>;
  systemVariables: Record<string, unknown>;
  userVariables: Record<string, unknown>;
};

type WindowWithDify = Window &
  typeof globalThis & {
    difyChatbotConfig?: DifyChatbotConfig;
  };

export function DifyChatbotEmbed() {
  useEffect(() => {
    const token = import.meta.env.VITE_DIFY_CHATBOT_TOKEN || DEFAULT_DIFY_TOKEN;
    const configuredBaseUrl = import.meta.env.VITE_DIFY_CHATBOT_BASE_URL;
    const httpsBaseUrl = import.meta.env.VITE_DIFY_CHATBOT_HTTPS_BASE_URL;
    const baseUrl = (
      configuredBaseUrl ||
      (window.location.protocol === 'https:' && httpsBaseUrl
        ? httpsBaseUrl
        : DEFAULT_DIFY_BASE_URL)
    ).replace(/\/$/, '');
    const scriptSrc = `${baseUrl}/embed.min.js`;
    const difyWindow = window as WindowWithDify;

    difyWindow.difyChatbotConfig = {
      token,
      baseUrl,
      dynamicScript: true,
      inputs: {},
      systemVariables: {},
      userVariables: {},
    };

    document.getElementById(token)?.remove();

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.id = token;
    script.defer = true;
    script.dataset.difyEmbed = 'technical-document';
    document.body.appendChild(script);

    return () => {
      script.remove();
      delete difyWindow.difyChatbotConfig;
      document.getElementById(BUTTON_ID)?.remove();
      document.getElementById(IFRAME_ID)?.remove();
    };
  }, []);

  return (
    <div data-tour="tech-chatbot">
      <style>{`
        #dify-chatbot-bubble-button {
          background-color: #1C64F2 !important;
        }

        #dify-chatbot-bubble-window {
          width: 24rem !important;
          height: 40rem !important;
        }

        @media (max-width: 640px) {
          #dify-chatbot-bubble-window {
            width: calc(100vw - 2rem) !important;
            height: min(40rem, calc(100vh - 6rem)) !important;
          }
        }
      `}</style>
    </div>
  );
}
