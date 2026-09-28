import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./Auth.jsx";
import "./styles.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>{(props) => <App key={props.member.id} {...props} />}</AuthGate>
  </React.StrictMode>,
);
