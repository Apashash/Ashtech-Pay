export { getOperatorDisplayName } from "@shared/operator-display";

export function getOperatorLogo(name: string): string | null {
  const n = name.toLowerCase().trim();
  if (n.includes("celtiis") || n.includes("celtis")) return "/op-celtiis.jpeg";
  if (n.includes("coris")) return "/op-coris.png";
  if (n.includes("ligdicash") || n.includes("ligdi cash") || n.includes("ligdi")) return "/op-ligdi-cash.jpeg";
  if (n.includes("djamo") || n.includes("diamo")) return "/op-djamo.jpg";
  if (n.includes("mynita") || n.includes("my nita")) return "/op-mynita.png";
  if (n.includes("amana")) return "/op-amana.png";
  if (/^e[-\s]?money$/.test(n) || n === "money") return "/op-e-money.png";
  if (n.includes("mtn")) return "/op-mtn.jpeg";
  if (n.includes("wave")) return "/op-wave.png";
  if (n.includes("airtel")) return "/op-airtel.png";
  if (n.includes("moov") || n.includes("flooz")) return "/op-moov.png";
  if (n.includes("free")) return "/op-freemoney.png";
  if (n.includes("smart") || n.includes("smartcash")) return "/op-smartcash.png";
  if (n.includes("telecel")) return "/op-telecel.jpeg";
  if (n.includes("mixx") || /t[\s_-]?money/.test(n)) return "/op-mixx-by-yas.png";
  if (n.includes("vodacom")) return "/op-vodacom.jpeg";
  if (n.includes("vodafone")) return "/op-vodafone.jpeg";
  if (n.includes("wizall")) return "/op-wizall.png";
  if (n.includes("zamani")) return "/op-zamani.png";
  if (n.includes("m-pesa") || n.includes("mpesa") || n.includes("m pesa")) return "/op-mpesa.png";
  if (n.includes("ezy")) return "/op-ezypesa.png";
  if (n.includes("halo")) return "/op-halopesa.jpeg";
  if (n.includes("tigo")) return "/op-tigopesa.jpeg";
  if (n.includes("ttcl")) return "/op-ttcl.png";
  if (n.includes("paga")) return "/op-paga.jpeg";
  if (n.includes("palmpay") || n.includes("palm")) return "/op-palmpay.jpeg";
  if (n.includes("afrimoney") || n.includes("afri")) return "/op-afrimoney.png";
  if (n.includes("opay")) return "/op-opay.png";
  if (n.includes("orange")) return "/op-orange-money.png";
  return null;
}
