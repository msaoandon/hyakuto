import { Shippori_Mincho } from "next/font/google";

const shipporiMincho = Shippori_Mincho({ weight: "800", subsets: ["latin"] });

export function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className={`${shipporiMincho.className} text-[72px]`}>百灯</span>
    </div>
  );
}
