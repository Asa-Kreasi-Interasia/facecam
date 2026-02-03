import Webcam from "react-webcam";
import { useState } from "react";
import { Check, X } from "lucide-react";

function App() {
  const text = "";
  const [buttonState, setButtonState] = useState("start"); // start, next, waiting
  const [isWebcamLoading, setIsWebcamLoading] = useState(true);

  // Data list dengan kondisi check/cross
  const listItems = [
    { text: "Item 1", isChecked: true },
    { text: "Item 2", isChecked: false },
    { text: "Item 3", isChecked: true },
  ];

  const handleButtonClick = () => {
    if (buttonState === "start") {
      setButtonState("next");
    } else if (buttonState === "next") {
      setButtonState("waiting");
    }
  };

  // Konfigurasi button berdasarkan state
  const buttonConfig = {
    start: {
      text: "Start",
      color: "bg-blue-500 hover:bg-blue-600",
      disabled: false,
    },
    next: {
      text: "Next",
      color: "bg-green-500 hover:bg-green-600",
      disabled: false,
    },
    waiting: { text: "Waiting", color: "bg-gray-400", disabled: true },
  };

  const currentButton = buttonConfig[buttonState];

  return (
    <div className="container flex min-h-screen min-w-screen justify-center items-center">
      <div className="flex gap-8">
        <div className="relative w-[640px] h-[480px]">
          {isWebcamLoading && (
            <div className="absolute inset-0 bg-gray-300 rounded-lg animate-pulse flex items-center justify-center z-10">
              <div className="text-gray-500 text-lg">Loading camera...</div>
            </div>
          )}
          <Webcam
            onUserMedia={() => setIsWebcamLoading(false)}
            width={640}
            height={480}
            className={
              isWebcamLoading
                ? "opacity-0 rounded-lg"
                : "opacity-100 transition-opacity duration-300 rounded-[30px]"
            }
          />
        </div>
        <div className="flex flex-col justify-between">
          <h1 className="text-center text-3xl font-bold">
            {text ? text : "TEXT VARIABLE FOR HEADER"}
          </h1>
          <ul className="space-y-2 mb-4">
            {listItems.map((item, index) => (
              <li key={index} className="flex items-center gap-2">
                {item.isChecked ? (
                  <Check className="text-green-600" size={20} />
                ) : (
                  <X className="text-red-600" size={20} />
                )}
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleButtonClick}
            disabled={currentButton.disabled}
            className={`${currentButton.color} text-white px-4 py-2 rounded-[24px] disabled:cursor-not-allowed`}
          >
            {currentButton.text}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
