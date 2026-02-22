import { FC } from "react";
import tw from "twin.macro";

interface PostingProgressProps {
    isPosting: boolean;  // Changed from isVisible
    message: string;
    step: number;
    totalSteps: number;
}

const ProgressContainer = tw.div`
    fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50
`;

const ProgressBox = tw.div`
    bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl
`;

const ProgressBar = tw.div`
    w-full bg-gray-200 rounded-full h-2.5 mt-4
`;

const ProgressFill = tw.div`
    bg-orange-500 h-2.5 rounded-full transition-all duration-300
`;

const Spinner = tw.div`
    inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]
`;

export const PostingProgress: FC<PostingProgressProps> = ({ 
    isPosting, 
    message, 
    step, 
    totalSteps 
}) => {
    if (!isPosting) return null;

    const progress = totalSteps > 0 ? (step / totalSteps) * 100 : 0;

    return (
        <ProgressContainer>
            <ProgressBox>
                <div tw="flex items-center justify-center mb-4">
                    <Spinner tw="text-orange-500" />
                </div>
                
                <h3 tw="text-lg font-semibold text-center mb-2">
                    Posting in Progress
                </h3>
                
                <p tw="text-sm text-gray-600 text-center mb-4">
                    {message}
                </p>
                
                <div tw="text-xs text-gray-500 text-center mb-2">
                    Step {step} of {totalSteps}
                </div>
                
                <ProgressBar>
                    <ProgressFill style={{ width: `${progress}%` }} />
                </ProgressBar>
                
                <p tw="text-xs text-gray-400 text-center mt-4">
                    Please don't close this window
                </p>
            </ProgressBox>
        </ProgressContainer>
    );
};