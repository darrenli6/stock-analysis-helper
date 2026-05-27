import { type AppType } from "next/app";

import { ThemeToggle } from "~/components/index/ThemeToggle";
import "~/styles/globals.css";

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <>
      <ThemeToggle />
      <Component {...pageProps} />
    </>
  );
};

export default MyApp;
