// Simple test endpoint
export default (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  return res.status(200).json({
    status: "ok",
    message: "Urban Pay test endpoint - Vercel API routing working!",
    timestamp: new Date().toISOString(),
    endpoint: "/api/test",
  });
};
