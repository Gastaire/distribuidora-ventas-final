import React from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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

const LocationPicker = ({ lat, lng, onChange }) => {
    // Por defecto centro de Tucumán si no hay coordenadas
    const center = (lat && lng) ? [lat, lng] : [-26.8241, -65.2226]; 

    return (
        <div className="rounded-xl overflow-hidden border-2 border-blue-400 bg-white" style={{ height: '280px' }}>
            <MapContainer center={center} zoom={13} style={{ height: '250px', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onLocationSelect={(lat, lng) => onChange(lat, lng)} />
                {lat && lng && <Marker position={[lat, lng]} />}
            </MapContainer>
            <p className="text-xs text-center text-gray-500 mt-1 py-1">Tocá el mapa para mover el marcador</p>
        </div>
    );
};

export default LocationPicker;
