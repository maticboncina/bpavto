import "twin.macro";

import styledImport, { css as cssImport, CSSProp } from "styled-components";

declare module "twin.macro" {
    // The styled and css imports
    const styled: typeof styledImport;
    const css: typeof cssImport;
}

declare module "react" {
    // The css prop
    // eslint-disable-next-line no-undef
    interface HTMLAttributes<T> extends DOMAttributes<T> {
        css?: CSSProp;
        tw?: string;
    }
    // The inline svg css prop
    // eslint-disable-next-line unused-imports/no-unused-vars, unicorn/prevent-abbreviations
    interface SVGProps<T> extends SVGProps<SVGSVGElement> {
        css?: CSSProp;
        tw?: string;
    }
}

// The 'as' prop on styled components
declare global {
    namespace JSX {
        // eslint-disable-next-line no-undef
        interface IntrinsicAttributes<T> extends DOMAttributes<T> {
            as?: string | Element;
        }
    }
}
