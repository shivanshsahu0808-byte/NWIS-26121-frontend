import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";


// Current Well ke liye blue marker
const currentIcon = new L.DivIcon({
  className: "",
  html: `
    <div class="well-marker current-marker">
      <div class="marker-dot"></div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});


// Offset Wells ke liye orange marker
const offsetIcon = new L.DivIcon({
  className: "",
  html: `
    <div class="well-marker offset-marker">
      <div class="marker-dot"></div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});


function WellMap({ wells }) {

  // Current Well identify karna
  const currentWell = wells.find(
    (well) => well.id === "W-A042"
  );

  // Data load hone tak
  if (!currentWell) {
    return (
      <div className="real-map loading-map">
        Loading wells...
      </div>
    );
  }


  return (
    <div className="real-map">

      <MapContainer
        center={[
          currentWell.latitude,
          currentWell.longitude,
        ]}
        zoom={13}
        scrollWheelZoom={true}
        style={{
          height: "100%",
          width: "100%",
        }}
      >

        {/* OpenStreetMap */}
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        {/* All wells */}
        {wells.map((well) => {

          const isCurrent =
            well.id === "W-A042";

          return (
            <Marker
              key={well.id}
              position={[
                well.latitude,
                well.longitude,
              ]}
              icon={
                isCurrent
                  ? currentIcon
                  : offsetIcon
              }
            >

              <Popup>

                <div className="well-popup">

                  <h3>{well.name}</h3>

                  <div className="popup-row">
                    <span>Depth</span>
                    <strong>
                      {well.depth} m
                    </strong>
                  </div>

                  <div className="popup-row">
                    <span>Formation</span>
                    <strong>
                      {well.formation}
                    </strong>
                  </div>

                  <div className="popup-row">
                    <span>Status</span>
                    <strong>
                      {well.status}
                    </strong>
                  </div>

                  <div
                    className={
                      isCurrent
                        ? "popup-badge current"
                        : "popup-badge offset"
                    }
                  >
                    {isCurrent
                      ? "CURRENT WELL"
                      : "OFFSET WELL"}
                  </div>

                </div>

              </Popup>

            </Marker>
          );
        })}

      </MapContainer>


      {/* Map Legend */}
      <div className="map-legend">

        <div>
          <span className="legend-dot current"></span>
          Current Well
        </div>

        <div>
          <span className="legend-dot offset"></span>
          Offset Well
        </div>

      </div>

    </div>
  );
}

export default WellMap;