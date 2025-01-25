import express from "express";
import React from "react";
import { render } from "ink";
import cors from "cors";
import App from "./components/app";
import morgan from "morgan";
import bootstrap from "./core/bootstrap";

bootstrap().then(() => {
    const expressApp = express();

    expressApp.use(
        express.json(),
        express.urlencoded({
            extended: true,
        })
    );

    expressApp.use(cors());

    expressApp.use(morgan("dev"));

    const server = expressApp.listen(process.env.PORT ?? "", () => {
        render(<App express={expressApp} server={server} />);
    });
});
