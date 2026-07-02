import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerIcon2xPng from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";
import { Loader2, MapPin, LocateFixed, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const markerIcon = L.icon({
  iconUrl: markerIconPng,
  iconRetinaUrl: markerIcon2xPng,
  shadowUrl: markerShadowPng,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface GeocodeResult {
  country?: string;
  countryCode?: string;
  city?: string;
}

interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number, info: GeocodeResult) => void;
  confirmed: boolean;
  onConfirm: () => void;
}

export interface LocationMapPickerHandle {
  flyTo: (lat: number, lng: number) => void;
  search: (query: string) => Promise<boolean>;
}

const DEFAULT_CENTER: [number, number] = [4.0511, 9.7679]; // Douala, Cameroun (fallback)

export const LocationMapPicker = forwardRef<LocationMapPickerHandle, LocationMapPickerProps>(function LocationMapPicker({
  latitude,
  longitude,
  onLocationChange,
  confirmed,
  onConfirm,
}: LocationMapPickerProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPoint, setHasPoint] = useState(!!(latitude && longitude));

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      const addr = data?.address || {};
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
      const country = addr.country || "";
      const countryCode = (addr.country_code || "").toUpperCase();
      onLocationChange(lat, lng, { country, countryCode, city });
    } catch {
      onLocationChange(lat, lng, {});
    } finally {
      setGeocoding(false);
    }
  }, [onLocationChange]);

  const placeMarker = useCallback((lat: number, lng: number, doGeocode = true) => {
    if (!mapRef.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: markerIcon, draggable: true }).addTo(mapRef.current);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLatLng();
        setHasPoint(true);
        reverseGeocode(pos.lat, pos.lng);
      });
    }
    mapRef.current.setView([lat, lng], mapRef.current.getZoom() < 13 ? 15 : mapRef.current.getZoom());
    setHasPoint(true);
    if (doGeocode) reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const searchAddress = useCallback(async (query: string): Promise<boolean> => {
    if (!query.trim()) return false;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        placeMarker(lat, lng);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setGeocoding(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number) => placeMarker(lat, lng, false),
    search: searchAddress,
  }), [searchAddress]);

  const locateMe = useCallback(() => {
    setError(null);
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        placeMarker(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setError("Impossible d'obtenir votre position. Vous pouvez cliquer sur la carte pour choisir manuellement.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [placeMarker]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] =
      latitude && longitude ? [latitude, longitude] : DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: latitude && longitude ? 15 : 6,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      placeMarker(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    if (latitude && longitude) {
      placeMarker(latitude, longitude, false);
    } else {
      // Auto-detect position by default so the user just has to confirm.
      locateMe();
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="w-full h-56 rounded-lg overflow-hidden border border-border z-0"
        data-testid="map-location-picker"
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={locateMe}
          disabled={locating}
          className="text-xs"
          data-testid="button-locate-me"
        >
          {locating ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <LocateFixed className="w-3.5 h-3.5 mr-1.5" />
          )}
          Utiliser ma position
        </Button>

        {hasPoint && (
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={geocoding}
            className={cnBtn(confirmed)}
            data-testid="button-confirm-location"
          >
            {geocoding ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : confirmed ? (
              <Check className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <MapPin className="w-3.5 h-3.5 mr-1.5" />
            )}
            {confirmed ? "Confirmé" : "Confirmer"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Déplacez le repère ou cliquez sur la carte pour ajuster votre position. Le pays et la ville se remplissent automatiquement.
      </p>
    </div>
  );
});

function cnBtn(confirmed: boolean) {
  return confirmed
    ? "text-xs bg-green-600 hover:bg-green-700 text-white"
    : "text-xs bg-yellow-500 hover:bg-yellow-600 text-black";
}
