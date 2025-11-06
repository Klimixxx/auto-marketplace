/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Разрешаем встраивание сайта в iframe с твоего портфолио-домена
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://studio-landing-sable.vercel.app"
          },
          // Снимаем старые запреты на встраивание (если были)
          { key: "X-Frame-Options", value: "ALLOWALL" }
        ],
      },
    ];
  },
};

module.exports = nextConfig;
