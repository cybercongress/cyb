import React from 'react';
import { Container } from 'unstated';
import { getContentByCid, initIpfs } from '../../utils';

const APP_NAME = '.cyber';
const SEARCH_RESULT_TIMEOUT_MS = 5000;

class SearchContainer extends Container {
    state = {
        browserSupport: false,

        defaultAddress: null,
        balance: 0,

        links: {},
        searchQuery: '',
        seeAll: false,

        successLinkMessage: false,
        errorLinkMessage: false,
    };

    constructor() {
        super();

        this.searchInput = React.createRef();
        this.cidToInput = React.createRef();
    }

    querySubscribers = [];

    init = () => {
        if (!window.cyber) {
            return;
        }

        initIpfs();

        window.cyb
            .getQuery()
            .then((query) => {
                this.setState({
                    browserSupport: true,
                    searchQuery: query,
                }, () => {
                    this.onQueryUpdate(query);
                });
            });

        window.cyb
            .onQueryUpdate((query) => {
                this.onQueryUpdate(query);
            });

        window.cyber
            .getDefaultAddress()
            .then(({ address, balance }) => {
                this.setState({
                    defaultAddress: address,
                    balance,
                });
            });
    };

    querySubscribe = (callback) => {
        this.querySubscribers = this.querySubscribers.concat(callback);
    };

    emitQueryUpdate = (query) => {
        this.querySubscribers.forEach((callback) => {
            callback(query);
        });
    };

    onQueryUpdate = (query) => {
        //this.searchInput.current.value = query;
        this.search(query);
        this.emitQueryUpdate(query);
    };

    search = (query) => {
        console.log('search query: ', query);

        this.closeMessages();

        if (query) {
            window.cyber.searchCids(query).then((result) => {
                console.log('result cids: ', result);

                const links = result.reduce((obj, link) => ({
                    ...obj,
                    [link.cid]: {
                        rank: link.rank,
                        status: 'loading',
                    },
                }), {});

                this.setState({
                    links,
                    searchQuery: query,
                });

                this.loadContent(links);
            });

            this.link(APP_NAME, query, true);
        } else {
            this.setState({
                searchQuery: query,
                links: {},
            });
        }
    };

    link = (from, to, inBackground = false) => {
        const address = this.state.defaultAddress;
        const cidFrom = from || this.searchInput.current.value;
        const cidTo = to || this.cidToInput.current.value;

        if (!address) {
            return;
        }

        window.cyber.link(cidFrom, cidTo, address)
            .then((result) => {
                console.log(`Linked ${cidFrom} with ${cidTo}. Results: `, result);

                if (!inBackground) {
                    this.setState(state => ({
                        successLinkMessage: true,
                        links: {
                            ...state.links,
                            newLink: {
                                rank: 'n/a',
                                status: 'success',
                                content: cidTo,
                            },
                        },
                    }));
                }
            })
            .catch((error) => {
                console.log(`Cant link ${cidFrom} with ${cidTo}. Error: `, error);

                if (!inBackground) {
                    this.setState({
                        errorLinkMessage: true,
                    });
                }
            });
    };

    loadContent = async (cids) => {
        const contentPromises = Object.keys(cids)
            .map(cid => getContentByCid(cid, SEARCH_RESULT_TIMEOUT_MS)
                .then((content) => {
                    const { links } = this.state;

                    links[cid] = {
                        ...links[cid],
                        status: 'success',
                        content,
                    };

                    this.setState({
                        links,
                    });
                })
                .catch(() => {
                    const { links } = this.state;

                    links[cid] = {
                        ...links[cid],
                        status: 'error',
                    };

                    this.setState({
                        links,
                    });
                }));

        Promise.all(contentPromises);
    };

    seeAll = () => {
        this.setState(state => ({
            seeAll: !state.seeAll,
        }));
    };

    openLink = (e, content) => {
        const { balance, defaultAddress: address } = this.state;
        const cidFrom = this.searchInput.current.value;
        const cidTo = content;

        console.log(`from: ${cidFrom} to: ${cidTo}. address: ${address}. balance: ${balance}`);

        window.cyber.link(cidFrom, cidTo, address);
    };

    closeMessages = () => {
        this.setState({
            successLinkMessage: false,
            errorLinkMessage: false,
        });
    };

    handleSearch = () => {
        const query = this.searchInput.current.value;

        window.cyb.setQuery(query);
        this.search(query);
        this.emitQueryUpdate(query);
    };

    handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            this.handleSearch();
        }
    };
}

export default new SearchContainer();