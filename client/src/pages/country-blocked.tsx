import { Globe, MapPin, ShieldX } from "lucide-react";

export default function CountryBlockedPage() {
  return (
    <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#1E2329] border-2 border-red-500/30 flex items-center justify-center">
              <Globe className="w-12 h-12 text-red-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <ShieldX className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-center gap-2">
          <img src="/logo.png" alt="AshTech Pay" className="h-10 w-auto" />
        </div>

        <h1 className="text-2xl font-bold text-white mt-4 mb-3">
          Service non disponible dans votre région
        </h1>

        <p className="text-gray-400 text-base leading-relaxed mb-6">
          <span className="text-[#F0B90B] font-semibold">Ashtech Pay</span> est une plateforme de paiement conçue exclusivement pour les marchés africains.
          <br /><br />
          Ce service n'est pas encore disponible dans votre pays.
        </p>

        <div className="bg-[#1E2329] border border-[#2C3140] rounded-2xl p-5 mb-6 text-left">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#F0B90B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-[#F0B90B]" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">Pays couverts</p>
              <p className="text-gray-400 text-sm">
                Cameroun, Sénégal, Côte d'Ivoire, Bénin, Togo, Burkina Faso, Mali, Gabon, Congo, RDC et plusieurs autres pays africains.
              </p>
            </div>
          </div>
        </div>

        <p className="text-gray-500 text-xs">
          Si vous pensez qu'il s'agit d'une erreur, contactez notre support à{" "}
          <a href="mailto:support@ashtechpay.com" className="text-[#F0B90B] hover:underline">
            support@ashtechpay.com
          </a>
        </p>
      </div>
    </div>
  );
}
