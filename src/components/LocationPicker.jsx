import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix para el ícono de Leaflet con Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const MapClickHandler = ({ onLocationSelect }) => {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

const MapFlyTo = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            map.flyTo([lat, lng], 16);
        }
    }, [lat, lng, map]);
    return null;
};

const LocationPicker = ({ lat, lng, onChange }) => {
    // Por defecto centro de Lules si no hay coordenadas
    const center = (lat && lng) ? [lat, lng] : [-26.9248, -65.3421]; 
    const [address, setAddress] = useState('');
    const [loadingAddress, setLoadingAddress] = useState(false);

    useEffect(() => {
        if (!lat || !lng) {
            setAddress('');
            return;
        }
        
        const fetchAddress = async () => {
            setLoadingAddress(true);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                const data = await res.json();
                if (data && data.display_name) {
                    // Tomamos una porción más corta de la dirección
                    const parts = data.display_name.split(',').slice(0, 3).join(', ');
                    setAddress(parts);
                }
            } catch (e) {
                console.error("Error al obtener dirección", e);
                setAddress('Dirección no disponible');
            } finally {
                setLoadingAddress(false);
            }
        };

        // Debounce simple para no saturar la API
        const timeoutId = setTimeout(fetchAddress, 1000);
        return () => clearTimeout(timeoutId);
    }, [lat, lng]);

    return (
        <div className="rounded-xl overflow-hidden border-2 border-blue-400 bg-white" style={{ height: 'auto' }}>
            <MapContainer center={center} zoom={13} style={{ height: '250px', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onLocationSelect={(lat, lng) => onChange(lat, lng)} />
                <MapFlyTo lat={lat} lng={lng} />
                {lat && lng && <Marker position={[lat, lng]} />}
            </MapContainer>
            <div className="text-center p-2">
                <p className="text-xs text-gray-500 font-medium">Tocá el mapa para mover el marcador</p>
                {(lat && lng) && (
                    <div className="mt-1 flex items-center justify-center text-xs text-blue-700 bg-blue-50 py-1 px-2 rounded">
                        {loadingAddress ? 'Buscando dirección...' : (address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationPicker;
