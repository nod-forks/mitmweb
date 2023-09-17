import { Flow, MessagesMeta } from "../../flow";
import { useAppDispatch, useAppSelector } from "../../ducks";
import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { ContentViewData, useContent } from "../contentviews/useContent";
import { MessageUtils } from "../../flow/utils";
import ViewSelector from "../contentviews/ViewSelector";
import { setContentViewFor } from "../../ducks/ui/flow";
import { formatTimeStamp } from "../../utils";
import LineRenderer from "../contentviews/LineRenderer";

type MessagesPropTypes = {
    flow: Flow;
    messages_meta: MessagesMeta;
};

function prettyPrintMercuryData(str: string) {
    const replaceEscapes = (s: string) => s.replaceAll(/\"/g, '"').replace(/\\\\/g, '\\');

    const tryParse = (input: string) => {
        try {
            return JSON.parse(replaceEscapes(input));
        } catch (e) {
            return input;
        }
    };

    const recursiveParse = (obj: { [x: string]: any; }) => {
        for (const key in obj) {
            obj[key] = tryParse(obj[key]);
            if (typeof obj[key] === 'object') {
                recursiveParse(obj[key]);
            }
        }
    };

    let parsed = tryParse(str);
    if (typeof parsed === 'object') {
        recursiveParse(parsed);
    }

    return parsed
}

export default function Messages({ flow, messages_meta }: MessagesPropTypes) {
    const dispatch = useAppDispatch();
    const [filter, setFilter] = useState('all')
    const isMercury = (flow.type === 'http' && flow.request.host.includes("edge-chat"))
    const defaultView = isMercury ? 'MQTT' : 'Auto'

    const forcePrettify = useState(isMercury)

    const contentView = useAppSelector(
        (state) => state.ui.flow.contentViewFor[flow.id + "messages"] || defaultView
    );
    let [maxLines, setMaxLines] = useState<number>(
        useAppSelector((state) => state.options.content_view_lines_cutoff)
    );
    const showMore = useCallback(
        () => setMaxLines(Math.max(1024, maxLines * 2)),
        [maxLines]
    );
    const content = useContent(
        MessageUtils.getContentURL(flow, "messages", contentView, maxLines + 1),
        flow.id + messages_meta.count
    );
    const messages =
        useMemo<ContentViewData[] | undefined>(() => {
            if (content) {
                try {
                    return JSON.parse(content);
                } catch (e) {
                    const err: ContentViewData[] = [
                        {
                            description: "Network Error",
                            lines: [[["error", `${content}`]]],
                        },
                    ];
                    return err;
                }
            }
        }, [content]) || [];

    return (
        <div className="contentview">
            <div className="controls">
                <h5>{messages_meta.count} Messages</h5>
                <div>
                    <input
                        type="radio"
                        id="all"
                        name="filter"
                        checked={filter === 'all'}
                        onChange={() => setFilter('all')}
                    />
                    <label htmlFor="all">All</label>

                    <input
                        type="radio"
                        id="onlySent"
                        name="filter"
                        checked={filter === 'onlySent'}
                        onChange={() => setFilter('onlySent')}
                    />
                    <label htmlFor="onlySent">Only Sent</label>

                    <input
                        type="radio"
                        id="onlyReceived"
                        name="filter"
                        checked={filter === 'onlyReceived'}
                        onChange={() => setFilter('onlyReceived')}
                    />
                    <label htmlFor="onlyReceived">Only Received</label>
                </div>
                <ViewSelector
                    value={contentView}
                    onChange={(cv) =>
                        dispatch(setContentViewFor(flow.id + "messages", cv))
                    }
                />
            </div>
            {messages.map((d: ContentViewData, i) => {
                if (filter === 'onlySent' && !d.from_client) return null
                if (filter === 'onlyReceived' && d.from_client) return null
                const className = `fa fa-fw fa-arrow-${
                    d.from_client ? "right text-primary" : "left text-danger"
                }`;
                const renderer = (
                    <div key={i}>
                        <small>
                            <i className={className} />
                            <span className="pull-right">
                                {d.timestamp && formatTimeStamp(d.timestamp)}
                            </span>
                        </small>
                        <LineRenderer
                            lines={d.lines}
                            maxLines={maxLines}
                            showMore={showMore}
                        />
                    </div>
                );
                maxLines -= d.lines.length;
                return renderer;
            }).filter(Boolean)}
        </div>
    );
}
