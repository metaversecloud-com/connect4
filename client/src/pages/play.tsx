import React from "react";

import "./play.css";
import { motion } from "framer-motion";

const PlayPage = () => {
  const [piece, setPiece] = React.useState(0);
  // const [scope, animate] = useAnimate();

  return (
    <div className="g-bk" style={{ width: "100%", height: "99vh", display: "flex", alignItems: "center" }}>
      <motion.div animate={{
        y: -100,
        opacity: 1,
        transition: {
          duration: 0.5,
          ease: "easeOut",
        }
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 40px)", gap: "6px", padding: "22px" }}>
          <button style={{ minWidth: "15px" }} onClick={() => setPiece(1)}>
            D
          </button>
          <button style={{ minWidth: "15px" }} onClick={() => setPiece(2)}>
            E
          </button>
          <button style={{ minWidth: "15px" }} onClick={() => setPiece(3)}>
            F
          </button>
          <button style={{ minWidth: "15px" }} onClick={() => setPiece(4)}>
            G
          </button>
          <button style={{ minWidth: "15px" }} onClick={() => setPiece(5)}>
            A
          </button>
          <button style={{ minWidth: "15px" }} onClick={() => setPiece(6)}>
            B
          </button>
          <button style={{ minWidth: "15px" }} onClick={() => setPiece(7)}>
            C
          </button>
        </div>

        <img
          src="/IMG_5268.PNG"
          alt="logo"
          style={{ width: "350px", height: "300px", zIndex: "10", position: "absolute" }}
        />

        <div style={{ zIndex: "5" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 40px)", gap: "5px", paddingLeft: "20px" }}>
            <div className={piece === 1 ? "piece" : ""} style={{ background: "#a91b0d", visibility: "hidden" }}></div>
            <div className={piece === 2 ? "piece" : ""} style={{ background: "#011F4B", visibility: "hidden" }}></div>
            <div className={piece === 3 ? "piece" : ""} style={{ background: "#a91b0d", visibility: "hidden" }}></div>
            <div className={piece === 4 ? "piece" : ""} style={{ background: "#011F4B", visibility: "hidden"}}></div>
            <div className={piece === 5 ? "piece" : ""} style={{ background: "#a91b0d", visibility: "hidden" }}></div>
            <div className={piece === 6 ? "piece" : ""} style={{ background: "#011F4B", visibility: "hidden" }}></div>
            <div className={piece === 7 ? "piece" : ""} style={{ background: "#a91b0d", visibility: "hidden" }}></div>
          </div>
        </div>
      </motion.div>

      {/* <div style={{background: "white", height: "400px", width: "100%", position: "absolute", top: "500px"}}>

      </div> */}
      {/* <h1>Play</h1> */}
      {/* <img src="/IMG_5459.png" alt="logo" style={{width: "100%"}}/> */}

      {/* <div style={{position: "absolute"}}> */}
      {/* <img
          src="/p2.png"
          alt="logo"
          style={{ width: "40px", marginLeft: "68px", marginTop: "30px", position: "absolute", top: 0, left: 0 }}
        /> */}
      {/* <img
          src="/p1.png"
          alt="logo"
          className="col-1"
        />
        <img
          src="/IMG_5268.PNG"
          alt="logo"
          style={{ width: "350px", height: "300px", position: "absolute", top: 0, left: 0 }}
        /> */}
      {/* </div> */}
      {/* <div
        style={{
          height: "90%",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          // zIndex: -1,
        }}
      >
        <div className="pieces1"></div>
        <div className="pieces1"></div>
        <div className="pieces1"></div>
        <div className="pieces1"></div>
        <div className="pieces1"></div>
      </div> */}
    </div>
  );
};

export default PlayPage;
