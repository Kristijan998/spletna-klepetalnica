function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) {
    return cfIp.trim();
  }

  return "";
}

function getHeader(req, name) {
  const value = req.headers[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]) return String(value[0]).trim();
  return "";
}

function countryNameFromCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return "";
  try {
    // Node runtime usually supports Intl.DisplayNames on Vercel.
    const display = new Intl.DisplayNames(["en"], { type: "region" });
    return display.of(normalized) || normalized;
  } catch {
    return normalized;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const ip = getClientIp(req);
    const vercelCountryCode = getHeader(req, "x-vercel-ip-country");
    const vercelRegion = getHeader(req, "x-vercel-ip-country-region");
    const vercelCity = getHeader(req, "x-vercel-ip-city");

    if (vercelCountryCode || vercelRegion || vercelCity) {
      res.status(200).json({
        ip: ip || null,
        country: countryNameFromCode(vercelCountryCode) || vercelCountryCode || null,
        region: vercelRegion || null,
        city: vercelCity || null,
        source: "vercel-headers",
      });
      return;
    }

    const endpoint = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : "https://ipapi.co/json/";
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });

    if (!response.ok) {
      res.status(200).json({ ip: ip || null, country: null, region: null, city: null, source: "none" });
      return;
    }

    const data = await response.json();
    res.status(200).json({
      ip: data?.ip || ip || null,
      country: data?.country_name || data?.country || null,
      region: data?.region || null,
      city: data?.city || null,
      source: "ipapi",
    });
  } catch {
    res.status(200).json({ ip: null, country: null, region: null, city: null, source: "error" });
  }
}
