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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const ip = getClientIp(req);
    const endpoint = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : "https://ipapi.co/json/";
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });

    if (!response.ok) {
      res.status(200).json({ ip: ip || null, country: null, region: null, city: null });
      return;
    }

    const data = await response.json();
    res.status(200).json({
      ip: data?.ip || ip || null,
      country: data?.country_name || data?.country || null,
      region: data?.region || null,
      city: data?.city || null,
    });
  } catch {
    res.status(200).json({ ip: null, country: null, region: null, city: null });
  }
}

