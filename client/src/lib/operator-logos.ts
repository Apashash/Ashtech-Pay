export function getOperatorLogo(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("mtn")) return "/op-mtn.jpeg";
  if (n.includes("wave")) return "/op-wave.png";
  if (n.includes("airtel")) return "/op-airtel.png";
  if (n.includes("moov")) return "/op-moov.png";
  if (n.includes("free")) return "/op-freemoney.png";
  if (n.includes("smart") || n.includes("smartcash")) return "/op-smartcash.png";
  if (n.includes("telecel")) return "/op-telecel.jpeg";
  if (n.includes("tmoney") || n.includes("t-money")) return "/op-tmoney.jpeg";
  if (n.includes("vodacom")) return "/op-vodacom.jpeg";
  if (n.includes("wizall")) return "/op-wizall.png";
  if (n.includes("zamani")) return "/op-zamani.png";
  return null;
}
