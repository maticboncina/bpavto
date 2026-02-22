import { FC } from "react";
import { PublishCarContainer } from "./PublishCarContainer";

export const Container: FC = () => {
    return (
        <div tw={"w-full flex flex-col gap-4 items-center"}>
            <PublishCarContainer />
        </div>
    );
};