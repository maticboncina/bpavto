import { FC, useCallback, useMemo, useState } from "react";
import { Container } from "./Container";
import { useChromeState } from "./state/state";
import tw from "twin.macro";
import { Button } from "./Button";
import { http } from "./http";

const Input = tw.input`outline-none border border-solid border-black p-1`;

export const PortalLoginContainer: FC = () => {
    const { portalUrl, setPortalUrl, accessToken, setAccessToken } = useChromeState();

    const [newPortalUrl, setNewPortalUrl] = useState(portalUrl);
    const [accessCode, setAccessCode] = useState("");

    const [loginError, setLoginError] = useState("");

    const isLoggedIn = useMemo(() => !!portalUrl && !!accessToken, [portalUrl, accessToken]);

    const doLogin = useCallback(() => {
        console.log("doing it");
        http.post<{ data: { token: string } }>("login", {
            access_code: accessCode,
        })
            .then((it) => {
                console.log(it.data);
                return it.data.data.token;
            })
            .then(setAccessToken)
            .catch(() => {
                setLoginError("Wrong acccess code");
            });
    }, [accessCode]);

    if (isLoggedIn)
        return (
            <div tw={"w-full flex flex-col gap-6"}>
                <Button onClick={() => setAccessToken("")}>Log out</Button>
                <Container />
            </div>
        );

    return (
        <div tw={"w-full flex flex-col gap-2 items-center"}>
            <div tw={"w-full flex flex-col gap-1"}>
                <label htmlFor="portal_url">Portal URL:</label>
                <div tw={"w-full flex gap-2"}>
                    <Input
                        id={"portal_url"}
                        type={"text"}
                        placeholder={"https://avtonet.ext.antony.cloud"}
                        defaultValue={portalUrl}
                        onChange={(event) => setNewPortalUrl(event.target.value)}
                    />
                    <Button onClick={() => setPortalUrl(newPortalUrl)}>Save</Button>
                </div>
            </div>
            <div tw={"w-full flex flex-col gap-1"}>
                <label htmlFor="access_code">Access code:</label>
                <Input
                    id={"access_code"}
                    type={"text"}
                    onChange={(event) => setAccessCode(event.target.value)}
                />
                <Button onClick={() => doLogin()}>Log in</Button>
                {loginError && <span tw={"text-red-800"}>{loginError}</span>}
            </div>
        </div>
    );
};
