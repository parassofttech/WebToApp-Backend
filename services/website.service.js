const axios = require("axios");

async function analyzeWebsite(url) {
  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid website URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(
      "Only HTTP and HTTPS websites are supported."
    );
  }

  try {
    const response = await axios.get(parsedUrl.toString(), {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 500,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WebsiteToAppBot/1.0)",
      },
    });

    const contentType =
      response.headers["content-type"] || "";

    return {
      url: response.request?.res?.responseUrl ||
        parsedUrl.toString(),

      statusCode: response.status,

      contentType,

      reachable: response.status >= 200 && response.status < 400,

      title: extractTitle(response.data),
    };
  } catch (error) {
    throw new Error(
      `Unable to reach website: ${error.message}`
    );
  }
}

function extractTitle(html) {
  if (typeof html !== "string") {
    return null;
  }

  const match = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  if (!match) {
    return null;
  }

  return match[1]
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

module.exports = {
  analyzeWebsite,
};