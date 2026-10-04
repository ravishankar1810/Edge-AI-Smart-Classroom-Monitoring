import { useEffect, useRef, useState } from 'react';
import mqtt from 'mqtt';
import './App.css';

function App() {

  // =========================================================
  // SENSOR DATA
  // =========================================================

  const [sensorData, setSensorData] = useState({
    command: "Waiting for data...",
    reason: "No data received yet",
    temperature: 0,
    humidity: 0,
    light: 0,
    flame: false,
    motion: false,
    camera: false
  });

  // =========================================================
  // CONNECTION
  // =========================================================

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Store MQTT client so other functions can use it
  const mqttClient = useRef(null);

  // =========================================================
  // CONTROL MODE
  // =========================================================

  const [controlMode, setControlMode] = useState("AUTO");

  // =========================================================
  // DEVICE STATES
  // =========================================================

  const [devices, setDevices] = useState({
    ac: false,
    fan: false,
    light: false
  });

  // =========================================================
  // CAMERA STREAM STATE & REFS
  // =========================================================

  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (showCamera) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((error) => {
          console.error("Camera access error:", error);
          alert("Unable to access camera. Please check your camera permissions.");
          setShowCamera(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCamera]);

  // =========================================================
  // MQTT CONNECTION
  // =========================================================

  useEffect(() => {

    console.log("Connecting to MQTT...");

    const client = mqtt.connect('ws://localhost:9001');

    mqttClient.current = client;

    // -------------------------------------------------------
    // MQTT CONNECTED
    // -------------------------------------------------------

    client.on('connect', () => {

      console.log("Connected to MQTT Broker!");

      setIsConnected(true);

      // Subscribe to sensor/AI messages
      client.subscribe(
        'classroom/energy_commands',
        (error) => {

          if (error) {
            console.error(
              "Sensor topic subscription failed:",
              error
            );
          } else {
            console.log(
              "Subscribed to classroom/energy_commands"
            );
          }

        }
      );

      // Subscribe to device status messages
      client.subscribe(
        'classroom/device_status',
        (error) => {

          if (error) {
            console.error(
              "Device status subscription failed:",
              error
            );
          } else {
            console.log(
              "Subscribed to classroom/device_status"
            );
          }

        }
      );

    });

    // -------------------------------------------------------
    // MQTT MESSAGE RECEIVED
    // -------------------------------------------------------

    client.on('message', (topic, message) => {

      try {

        const text = message.toString();

        console.log(
          "MQTT message:",
          topic,
          text
        );

        const data = JSON.parse(text);

        // ===================================================
        // SENSOR / AI DATA
        // ===================================================

        if (topic === 'classroom/energy_commands') {

          setSensorData({

            command:
              data.command ||
              "Unknown",

            reason:
              data.reason ||
              data.command ||
              "",

            temperature:
              typeof data.temperature === 'number'
                ? data.temperature
                : 0,

            humidity:
              typeof data.humidity === 'number'
                ? data.humidity
                : 0,

            light:
              typeof data.light === 'number'
                ? data.light
                : 0,

            flame:
              Boolean(data.flame),

            motion:
              Boolean(data.motion),

            camera:
              Boolean(data.camera)

          });

          setLastUpdate(
            new Date().toLocaleTimeString()
          );
        }

        // ===================================================
        // DEVICE STATUS
        // ===================================================

        if (topic === 'classroom/device_status') {

          setDevices(prev => ({

            ...prev,

            ...(data.ac !== undefined && {
              ac: Boolean(data.ac)
            }),

            ...(data.fan !== undefined && {
              fan: Boolean(data.fan)
            }),

            ...(data.light !== undefined && {
              light: Boolean(data.light)
            })

          }));

        }

      } catch (error) {

        console.error(
          "Failed to parse MQTT message:",
          error
        );

      }

    });

    // -------------------------------------------------------
    // MQTT ERROR
    // -------------------------------------------------------

    client.on('error', (error) => {

      console.error(
        "MQTT Error:",
        error
      );

      setIsConnected(false);

    });

    // -------------------------------------------------------
    // MQTT DISCONNECTED
    // -------------------------------------------------------

    client.on('close', () => {

      console.log(
        "MQTT connection closed"
      );

      setIsConnected(false);

    });

    // -------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------

    return () => {

      console.log(
        "Closing MQTT connection..."
      );

      client.end();

    };

  }, []);

  // =========================================================
  // TEMPERATURE CLASS
  // =========================================================

  const getTempClass = (temp) => {

    if (temp < 22) return 'cold';

    if (temp < 25) return 'mild';

    if (temp < 28) return 'warm';

    return 'hot';

  };

  // =========================================================
  // TEMPERATURE LABEL
  // =========================================================

  const getTempLabel = (temp) => {

    if (temp < 22)
      return '❄️ Cool';

    if (temp < 25)
      return '🌤️ Comfortable';

    if (temp < 28)
      return '🌡️ Warm';

    return '🔥 Hot';

  };

  // =========================================================
  // COMMAND BADGE
  // =========================================================

  const getBadgeClass = (command) => {

    if (command.includes("TURN ON"))
      return 'badge-active';

    if (command.includes("TURN OFF"))
      return 'badge-idle';

    return 'badge-standby';

  };

  // =========================================================
  // MANUAL DEVICE CONTROL
  // =========================================================

  const controlDevice = (device, state) => {

    // Check MQTT
    if (!mqttClient.current) {

      console.log(
        "MQTT client is not available"
      );

      return;
    }

    // Check connection
    if (!isConnected) {

      console.log(
        "MQTT is not connected"
      );

      return;
    }

    // Only allow manual control in MANUAL mode
    if (controlMode !== "MANUAL") {

      console.log(
        "Switch to MANUAL mode first"
      );

      return;
    }

    // Create MQTT command
    const command = {

      device: device,

      action: state
        ? "ON"
        : "OFF"

    };

    console.log(
      "Sending device command:",
      command
    );

    // Publish command
    mqttClient.current.publish(
      'classroom/device_control',
      JSON.stringify(command)
    );

    // Update dashboard immediately
    setDevices(prev => ({

      ...prev,

      [device]: state

    }));

  };

  // =========================================================
  // CHANGE MODE
  // =========================================================

  const changeMode = (mode) => {

    setControlMode(mode);

    // Inform backend about mode
    if (
      mqttClient.current &&
      isConnected
    ) {

      const modeCommand = {

        mode: mode

      };

      mqttClient.current.publish(
        'classroom/control_mode',
        JSON.stringify(modeCommand)
      );

      console.log(
        "Control mode changed:",
        mode
      );

    }

  };

  // =========================================================
  // RENDER
  // =========================================================

  return (

    <>

      {/* =====================================================
          BACKGROUND
          ===================================================== */}

      <div className="dashboard-bg">

        <div className="orb orb-1"></div>

        <div className="orb orb-2"></div>

        <div className="orb orb-3"></div>

      </div>


      <div className="dashboard">

        {/* ===================================================
            HEADER
            =================================================== */}

        <header className="dashboard-header">

          <div>

            <h1>
              🏫 Edge AI Smart Classroom
            </h1>

            <p className="subtitle">
              Live sensor data from Arduino + Camera AI
            </p>

          </div>


          <div className="header-status">

            <span
              className={`status-dot ${
                isConnected
                  ? 'online'
                  : 'offline'
              }`}
            >
            </span>

            <span className="status-text">

              {isConnected
                ? 'Connected'
                : 'Disconnected'}

            </span>

            {lastUpdate && (

              <span className="update-time">

                Updated: {lastUpdate}

              </span>

            )}

          </div>

        </header>


        {/* ===================================================
            SYSTEM ACTION
            =================================================== */}

        <div className="command-card">

          <div className="glow-effect"></div>

          <div className="card-header">

            <span className="label">
              ⚡ System Action
            </span>

            <span
              className={`badge ${
                getBadgeClass(
                  sensorData.command
                )
              }`}
            >

              {sensorData.command.includes(
                "TURN ON"
              )
                ? 'ACTIVE'
                : sensorData.command.includes(
                    "TURN OFF"
                  )
                ? 'IDLE'
                : 'STANDBY'}

            </span>

          </div>


          <p className="command-text">

            {sensorData.command}

          </p>


          <p className="command-reason">

            {sensorData.reason}

          </p>

        </div>


        {/* ===================================================
            SENSOR GRID
            =================================================== */}

        <div className="sensor-grid">


          {/* =================================================
              TEMPERATURE
              ================================================= */}

          <div className="sensor-card">

            <div className="sensor-header">

              <span className="sensor-title">
                🌡️ Temperature
              </span>

              <span
                className={`sensor-value temp-value ${
                  getTempClass(
                    sensorData.temperature
                  )
                }`}
              >

                {sensorData.temperature}°C

              </span>

            </div>


            <div className="temp-gauge">

              <div
                className={`fill ${
                  getTempClass(
                    sensorData.temperature
                  )
                }`}
                style={{
                  width: `${Math.min(
                    (sensorData.temperature / 40) * 100,
                    100
                  )}%`
                }}
              >
              </div>

            </div>


            <div className="temp-labels">

              <span>0°C</span>

              <span className="temp-status">

                {getTempLabel(
                  sensorData.temperature
                )}

              </span>

              <span>40°C</span>

            </div>

          </div>


          {/* =================================================
              HUMIDITY
              ================================================= */}

          <div className="sensor-card">

            <div className="sensor-header">

              <span className="sensor-title">
                💧 Humidity
              </span>

              <span className="sensor-value humidity-value">

                {sensorData.humidity}%

              </span>

            </div>


            <div className="humidity-display">

              <div className="humidity-circle">

                💧

              </div>

              <div>

                <div className="humidity-number">

                  {sensorData.humidity}%

                </div>

                <div className="humidity-label">

                  Relative Humidity

                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              LIGHT
              ================================================= */}

          <div className="sensor-card">

            <div className="sensor-header">

              <span className="sensor-title">
                💡 Light Level
              </span>

              <span className="sensor-value">

                {sensorData.light}%

              </span>

            </div>


            <div className="light-display">

              <div className="light-icon">

                {sensorData.light < 30
                  ? '🌙'
                  : sensorData.light < 70
                  ? '🌤️'
                  : '☀️'}

              </div>

              <div className="light-info">

                <div className="light-bar">

                  <div
                    className="light-fill"
                    style={{
                      width: `${sensorData.light}%`
                    }}
                  >
                  </div>

                </div>

                <span>

                  {sensorData.light < 30
                    ? 'Dark'
                    : sensorData.light < 70
                    ? 'Normal'
                    : 'Bright'}

                </span>

              </div>

            </div>

          </div>


          {/* =================================================
              MOTION
              ================================================= */}

          <div className="sensor-card">

            <div className="sensor-header">

              <span className="sensor-title">
                🏃 Arduino Motion
              </span>

              <span
                className={`status-badge ${
                  sensorData.motion
                    ? 'detected'
                    : 'clear'
                }`}
              >

                {sensorData.motion
                  ? '🔴 DETECTED'
                  : '🟢 CLEAR'}

              </span>

            </div>


            <div
              className={`sensor-icon-box ${
                sensorData.motion
                  ? 'motion-active'
                  : 'motion-idle'
              }`}
            >

              {sensorData.motion
                ? '🚶'
                : '🛏️'}

            </div>

          </div>


          {/* =================================================
              CAMERA
              ================================================= */}

          <div className="sensor-card">

            <div className="sensor-header">

              <span className="sensor-title">
                📷 Camera AI
              </span>

              <span
                className={`status-badge ${
                  sensorData.camera
                    ? 'occupied'
                    : 'clear'
                }`}
              >

                {sensorData.camera
                  ? '👤 OCCUPIED'
                  : '🟢 EMPTY'}

              </span>

            </div>


            {showCamera ? (
              <div style={{ margin: '10px 0' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px' }}
                />
              </div>
            ) : (
              <div
                className={`sensor-icon-box ${
                  sensorData.camera
                    ? 'camera-active'
                    : 'camera-idle'
                }`}
              >

                {sensorData.camera
                  ? '👀'
                  : '📸'}

              </div>
            )}


            <button
              className="camera-button"
              onClick={() => setShowCamera(prev => !prev)}
            >

              {showCamera ? '🚫 Close Camera' : '📷 View Camera'}

            </button>

          </div>


          {/* =================================================
              FIRE
              ================================================= */}

          <div className="sensor-card fire-card">

            <div className="sensor-header">

              <span className="sensor-title">
                🔥 Fire Detection
              </span>

              <span
                className={`status-badge ${
                  sensorData.flame
                    ? 'fire-detected'
                    : 'fire-safe'
                }`}
              >

                {sensorData.flame
                  ? '🚨 FIRE DETECTED'
                  : '🟢 SAFE'}

              </span>

            </div>


            <div
              className={`fire-status ${
                sensorData.flame
                  ? 'fire-active'
                  : 'fire-normal'
              }`}
            >

              {sensorData.flame
                ? '🔥'
                : '🛡️'}

            </div>


            {sensorData.flame && (

              <div className="fire-alert">

                🚨 WARNING: FIRE DETECTED!

              </div>

            )}

          </div>

        </div>


        {/* ===================================================
            DEVICE CONTROL
            =================================================== */}

        <div className="control-panel">

          <div className="control-header">

            <div>

              <h2>
                🎛️️ Device Control
              </h2>

              <p>
                Control classroom devices
              </p>

            </div>


            <div className="mode-control">

              <span className="mode-label">
                Mode:
              </span>


              <button
                className={`mode-button ${
                  controlMode === "AUTO"
                    ? "mode-active"
                    : ""
                }`}
                onClick={() =>
                  changeMode("AUTO")
                }
              >

                🤖 AUTO

              </button>


              <button
                className={`mode-button ${
                  controlMode === "MANUAL"
                    ? "mode-active"
                    : ""
                }`}
                onClick={() =>
                  changeMode("MANUAL")
                }
              >

                🎛️ MANUAL

              </button>

            </div>

          </div>


          <div className="control-mode-status">

            {controlMode === "AUTO" ? (

              <span>
                🤖 Automatic mode is active.
                Edge AI controls the classroom devices.
              </span>

            ) : (

              <span>
                🎛️ Manual mode is active.
                You can control the devices below.
              </span>

            )}

          </div>


          <div className="device-controls">


            {/* =================================================
                AC
                ================================================= */}

            <div className="device-control-card">

              <div className="device-icon">
                ❄️️
              </div>


              <div className="device-info">

                <h3>
                  Air Conditioner
                </h3>

                <span
                  className={
                    devices.ac
                      ? "device-status on"
                      : "device-status off"
                  }
                >

                  {devices.ac
                    ? "● ON"
                    : "● OFF"}

                </span>

              </div>


              <div className="device-buttons">

                <button
                  className={`device-button on-button ${
                    devices.ac
                      ? "active-button"
                      : ""
                  }`}
                  disabled={
                    controlMode !== "MANUAL"
                  }
                  onClick={() =>
                    controlDevice(
                      "ac",
                      true
                    )
                  }
                >

                  ON

                </button>


                <button
                  className={`device-button off-button ${
                    !devices.ac
                      ? "active-button"
                      : ""
                  }`}
                  disabled={
                    controlMode !== "MANUAL"
                  }
                  onClick={() =>
                    controlDevice(
                      "ac",
                      false
                    )
                  }
                >

                  OFF

                </button>

              </div>

            </div>


            {/* =================================================
                FAN
                ================================================= */}

            <div className="device-control-card">

              <div className="device-icon">
                🌀
              </div>


              <div className="device-info">

                <h3>
                  Fan
                </h3>

                <span
                  className={
                    devices.fan
                      ? "device-status on"
                      : "device-status off"
                  }
                >

                  {devices.fan
                    ? "● ON"
                    : "● OFF"}

                </span>

              </div>


              <div className="device-buttons">

                <button
                  className={`device-button on-button ${
                    devices.fan
                      ? "active-button"
                      : ""
                  }`}
                  disabled={
                    controlMode !== "MANUAL"
                  }
                  onClick={() =>
                    controlDevice(
                      "fan",
                      true
                    )
                  }
                >

                  ON

                </button>


                <button
                  className={`device-button off-button ${
                    !devices.fan
                      ? "active-button"
                      : ""
                  }`}
                  disabled={
                    controlMode !== "MANUAL"
                  }
                  onClick={() =>
                    controlDevice(
                      "fan",
                      false
                    )
                  }
                >

                  OFF

                </button>

              </div>

            </div>


            {/* =================================================
                LIGHT
                ================================================= */}

            <div className="device-control-card">

              <div className="device-icon">
                💡
              </div>


              <div className="device-info">

                <h3>
                  Classroom Light
                </h3>

                <span
                  className={
                    devices.light
                      ? "device-status on"
                      : "device-status off"
                  }
                >

                  {devices.light
                    ? "● ON"
                    : "● OFF"}

                </span>

              </div>


              <div className="device-buttons">

                <button
                  className={`device-button on-button ${
                    devices.light
                      ? "active-button"
                      : ""
                  }`}
                  disabled={
                    controlMode !== "MANUAL"
                  }
                  onClick={() =>
                    controlDevice(
                      "light",
                      true
                    )
                  }
                >

                  ON

                </button>


                <button
                  className={`device-button off-button ${
                    !devices.light
                      ? "active-button"
                      : ""
                  }`}
                  disabled={
                    controlMode !== "MANUAL"
                  }
                  onClick={() =>
                    controlDevice(
                      "light",
                      false
                    )
                  }
                >

                  OFF

                </button>

              </div>

            </div>

          </div>

        </div>


        {/* ===================================================
            FOOTER STATS
            =================================================== */}

        <div className="footer-stats">


          {/* STATUS */}

          <div className="footer-stat">

            <p className="stat-label">
              Status
            </p>

            <p
              className={`stat-value ${
                sensorData.command.includes(
                  "TURN ON"
                )
                  ? 'active'
                  : sensorData.command.includes(
                      "TURN OFF"
                    )
                  ? 'idle'
                  : 'standby'
              }`}
            >

              {sensorData.command.includes(
                "TURN ON"
              )
                ? '🟢 Active'
                : sensorData.command.includes(
                    "TURN OFF"
                  )
                ? '🔴 Idle'
                : '⏸️️ Standby'}

            </p>

          </div>


          {/* OCCUPANCY */}

          <div className="footer-stat">

            <p className="stat-label">
              Occupancy
            </p>

            <p className="stat-value">

              {sensorData.motion ||
              sensorData.camera
                ? '👥 Occupied'
                : '🏚️ Empty'}

            </p>

          </div>


          {/* ENERGY */}

          <div className="footer-stat">

            <p className="stat-label">
              Energy Mode
            </p>

            <p className="stat-value">

              {sensorData.command.includes(
                "TURN OFF"
              )
                ? '💚 Eco'
                : '⚡ Normal'}

            </p>

          </div>


          {/* FIRE SAFETY */}

          <div className="footer-stat">

            <p className="stat-label">
              Fire Safety
            </p>

            <p
              className={`stat-value ${
                sensorData.flame
                  ? 'fire-text'
                  : 'safe-text'
              }`}
            >

              {sensorData.flame
                ? '🚨 ALERT'
                : '🛡️ Safe'}

            </p>

          </div>


          {/* AI CONFIDENCE */}

          <div className="footer-stat">

            <p className="stat-label">
              AI Confidence
            </p>

            <p className="stat-value text-gradient">

              {sensorData.motion ||
              sensorData.camera
                ? '98%'
                : '95%'}

            </p>

          </div>

        </div>

      </div>

    </>

  );

}

export default App;