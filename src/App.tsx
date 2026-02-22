import { useCallback, useEffect, useState } from "react";
import LogoUrl from "/logo.svg";
import { TabContext } from "./context/TabContext";
import { useInterval } from "./hooks/useInterval";
import { useIsLoggedIn } from "./hooks/useIsLoggedIn";
import { PortalLoginContainer } from "./PortalLoginContainer";

function App() {
    const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | undefined>();

    const queryTab = useCallback(() => {
        chrome.tabs.query({ active: true }, (tabs) => {
            if (tabs.length > 0)
                setCurrentTab((curr) => (curr?.url !== tabs[0].url ? tabs[0] : curr));
        });
    }, [setCurrentTab]);

    useInterval(1000, queryTab);

    useEffect(() => {
        queryTab();
    }, [queryTab]);

    const isLoggedIn = useIsLoggedIn(currentTab);

return (
    <div
        style={{
            width: "400px",  // Full width
            minWidth: "400px",
            maxWidth: "400px",
            height: "auto",
            minHeight: "200px",
            backgroundColor: "rgb(251 146 60)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            padding: "1rem",  // Keep vertical padding
            paddingLeft: "0.75rem",  // Small horizontal padding
            paddingRight: "0.75rem",
            fontSize: "14px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            position: "relative",
            zoom: 1,
            transform: "scale(1)",
            boxSizing: "border-box",
            overflow: "hidden",
        }}
    >
            {!currentTab ? (
                <h3 style={{ margin: 0, fontSize: '16px' }}>Loading...</h3>
            ) : !currentTab.url?.includes("avto.net/_2016mojavtonet") ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Only available in moj.avto.net</h3>
                    <a
                        href="https://www.avto.net/_2016mojavtonet/"
                        target="_blank"
                        style={{
                            padding: '0.5rem',
                            border: '1px solid black',
                            backgroundColor: 'white',
                            color: 'black',
                            textDecoration: 'none',
                            borderRadius: '0.25rem',
                            transition: 'background-color 0.15s',
                            fontSize: '14px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgb(229 229 229)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        Open
                    </a>
                </div>
            ) : !isLoggedIn ? (
                <h3 style={{ margin: 0, fontSize: '16px' }}>You must be logged in</h3>
            ) : (
                <>
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1rem'
                    }}>
                        <img src={LogoUrl} height="40" alt="Logo" />
                        <h3 style={{ margin: 0, fontSize: '18px' }}>Avto.net helper</h3>
                    </div>
                    <TabContext.Provider value={currentTab}>
                        <PortalLoginContainer />
                    </TabContext.Provider>
                </>
            )}
        </div>
    );
}

export default App;