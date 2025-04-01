import React, { useEffect, useState } from "react";
import success from "../assets/success.png";
import firebase from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

const Success = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Processing your payment...");

  // Get session_id from URL query parameters
  const queryParams = new URLSearchParams(location.search);
  const sessionId = queryParams.get("session_id");

  useEffect(() => {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        setUserId(user.uid);

        if (sessionId) {
          // Check session status
          try {
            const response = await fetch(
              `http://localhost:5000/api/v1/session/${sessionId}`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            const data = await response.json();

            if (data.session && data.session.payment_status === "paid") {
              setMessage("Payment successful! You're all set.");
              setLoading(false);
            } else {
              setMessage(
                "Your payment is being processed. This may take a moment."
              );

              // The webhook will handle the database updates, so we just need to notify the server
              await fetch("http://localhost:5000/api/v1/payment-success", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ sessionId: sessionId }),
              });

              setLoading(false);
            }
          } catch (error) {
            console.error("Error checking session status:", error);
            setMessage(
              "There was an error processing your payment. Please contact support."
            );
            setLoading(false);
          }
        } else {
          setMessage("Session information missing. Please try again.");
          setLoading(false);
        }
      } else {
        navigate("/login");
      }
    });
  }, [userId, sessionId, navigate]);

  const handleContinue = () => {
    navigate("/");
  };

  return (
    <div className="m-0 p-0">
      <div className="w-full min-h-[80vh] flex flex-col justify-center items-center">
        <div className="my-10 text-green-600 text-2xl mx-auto flex flex-col justify-center items-center">
          <img src={success} alt="" width={220} height={220} />
          <h3 className="text-4xl pt-20 lg:pt-0 font-bold text-center text-slate-700">
            {message}
          </h3>
          <button
            onClick={handleContinue}
            disabled={loading}
            className={`w-40 uppercase ${
              loading ? "bg-gray-400" : "bg-[#009C96]"
            } text-white text-xl my-16 px-2 py-2 rounded`}
          >
            {loading ? "Processing..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Success;
