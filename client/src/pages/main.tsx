import "./play.css";
import { motion, useAnimate } from "framer-motion";
import { useNavigate } from 'react-router-dom';


const MainPage = () => {

  const [scope, animate] = useAnimate();

  const transitionValues = {
    duration: 0.8,
    repeat: Infinity,
    repeatType: "reverse",
    ease: "easeOut",
  };

  const ballStyle = {
    display: "block",
    width: "5rem",
    height: "5rem",
    backgroundColor: "white",
    borderRadius: "5rem",
    marginRight: "auto",
    marginLeft: "auto",
    zIndex: "10",
  };

  // const onAnimationComplete = () => {
  //   console.log("Animation completed");
  // }

  const navigate = useNavigate();

  const onButtonClick = async () => {
    animate([[".btn-start", { opacity: 0 }, {duration: 0.5, ease: "easeOut"}]])
    await animate([[".header-img", { y: -400 }, {duration: 0.5, ease: "easeOut"}]])
    navigate("/play");
  }

  

  return (
    <div
      style={{
        // background: "pink",
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignContent: "center",
        flexDirection: "column",
      }}
      className="g-bk"
      ref={scope}
    >
      <img src="/top-main.png" alt="logo" style={{ width: "100%s", height: "500px", paddingBottom: "100px" }} className="header-img"/>
      <div style={{ width: "100vw", height: "230px" }}>
        <motion.span
          style={ballStyle}
          transition={{
            y: transitionValues,
            width: transitionValues,
            height: transitionValues,
          }}
          animate={{
            y: ["2rem", "8rem", "10rem"],
            width: ["5rem", "5rem", "6rem"],
            height: ["5rem", "5rem", "4rem"],
          }}
        />
      </div>

      <button style={{width: "50%", alignSelf: "center"}} className="btn-start" onClick={onButtonClick}>Start Game</button>
    </div>
  );
};

export default MainPage;
