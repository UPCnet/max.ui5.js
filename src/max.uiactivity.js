/*global max */
/*global MaxClient */
/* @fileoverview Main Activity Stream widget module
 */
'use strict';
(function(jq) {
    /**
     *    MaxUI plugin definition
     *    @param {Object} options    Object containing overrides for default values
     **/
    jq.fn.maxUIActivity = function(options) {
        // Keep a reference of the context object
        var maxui = this;
        maxui.version = '4.1.21';
        maxui.templates = max.templates();
        maxui.utils = max.utils();
        var defaults = {
            'maxRequestsAPI': 'jquery',
            'maxServerURL': 'https://max.upc.edu',
            'readContext': undefined,
            'writeContexts': [],
            'activitySource': 'timeline',
            'enableAlerts': false,
            'UISection': 'timeline',
            'disableTimeline': false,
            'disableConversations': true,
            'conversationsSection': 'conversations',
            'currentConversationSection': 'conversations',
            'activitySortOrder': 'comments',
            'activitySortView': 'recent',
            'maximumConversations': 20,
            'contextTagsFilter': [],
            'scrollbarWidth': 10,
            'widgetWidth': '0',
            'sectionHorizontalPadding': 20,
            'widgetBorder': 2,
            'loglevel': 'info',
            'hidePostboxOnTimeline': false,
            'maxTalkURL': "",
            'generator': "",
            'domain': "",
            'showSubscriptionList': false
        };
        // extend defaults with user-defined settings
        maxui.settings = jq.extend(defaults, options);
        maxui.logger = new max.MaxLogging(maxui);
        maxui.logger.setLevel(maxui.settings.loglevel);
        // Configure maxui without CORS if CORS not available
        if (!maxui.utils.isCORSCapable()) {
            // IF it has been defined an alias, set as max server url
            if (maxui.settings.maxServerURLAlias) {
                maxui.settings.maxServerURL = maxui.settings.maxServerURLAlias;
            }
        }
        // Normalize maxTalkURL and provide sensible default for stomp server
        // The base url for stomp url construction is based on the max url AFTER
        // checking for CORS avalability
        maxui.settings.maxTalkURL = maxui.utils.normalizeWhiteSpace(maxui.settings.maxTalkURL);
        if (_.isUndefined(maxui.settings.maxTalkURL) || maxui.settings.maxTalkURL === "") {
            maxui.settings.maxTalkURL = maxui.settings.maxServerURL + '/stomp';
        }
        // Normalize domain if present, to avoid errors with unvalid values and whitespaces
        maxui.settings.domain = maxui.utils.normalizeWhiteSpace(maxui.settings.domain);
        if (maxui.settings.domain.toLowerCase() === 'none') {
            maxui.settings.domain = "";
        }
        // Check timeline/activities consistency
        if (maxui.settings.UISection === 'timeline' && maxui.settings.activitySource === 'timeline' && maxui.settings.readContext) {
            maxui.settings.readContext = undefined;
            maxui.settings.writeContexts = [];
        }
        // Check showSubscriptionList consistency
        if (maxui.settings.showSubscriptionList && maxui.settings.activitySource === 'activities') {
            maxui.settings.showSubscriptionList = false;
        }
        // Get language from options or set default.
        // Set literals in the choosen language and extend from user options
        maxui.language = options.language || 'en';
        var user_literals = options.literals || {};
        maxui.settings.literals = jq.extend(max.literals(maxui.language), user_literals);
        if (maxui.settings.readContext) {
            // Calculate readContextHash
            maxui.settings.readContextHash = maxui.utils.sha1(maxui.settings.readContext);
            // Add read context to write contexts
            maxui.settings.writeContexts.push(maxui.settings.readContext);
            // Store the hashes of the write contexts
            maxui.settings.writeContextsHashes = [];
            for (var wc = 0; wc < maxui.settings.writeContexts.length; wc++) {
                maxui.settings.writeContextsHashes.push(maxui.utils.sha1(maxui.settings.writeContexts[wc]));
            }
        }
        //set default avatar and profile url pattern if user didn't provide it
        if (!maxui.settings.avatarURLpattern) {
            maxui.settings.avatarURLpattern = maxui.settings.maxServerURL + '/people/{0}/avatar';
        }
        if (!maxui.settings.contextAvatarURLpattern) {
            maxui.settings.contextAvatarURLpattern = maxui.settings.maxServerURL + '/contexts/{0}/avatar';
        }
        if (!maxui.settings.conversationAvatarURLpattern) {
            maxui.settings.conversationAvatarURLpattern = maxui.settings.maxServerURL + '/conversations/{0}/avatar';
        }
        // Disable profileURL by now
        // if (!maxui.settings.profileURLpattern)
        //        maxui.settings['profileURLpattern'] = maxui.settings.maxServerURL+'/profiles/{0}'
        // Catch errors triggered by failed max api calls
        if (maxui.settings.enableAlerts) {
            jq(window).bind('maxclienterror', function(event, xhr) {
                var error = JSON.parse(xhr.responseText);
                alert('The server responded with a "{0}" error, with the following message: "{1}". \n\nPlease try again later or contact administrator at admin@max.upc.edu.'.format(error.error, error.error_description));
            });
        }
        // Init MAX Client
        maxui.maxClient = new MaxClient();
        var maxclient_config = {
            server: maxui.settings.maxServerURL,
            mode: maxui.settings.maxRequestsAPI,
            username: maxui.settings.username,
            token: maxui.settings.oAuthToken
        };
        maxui.maxClient.configure(maxclient_config);
        // Create a instance of a max messaging client
        // This needs to be before MaxConversations instance creation
        maxui.messaging = new max.MaxMessaging(maxui);
        // View representing the conversations section
        maxui.conversations = new max.views.MaxConversations(maxui, {});
        // Bind conversation message receiving
        if (!maxui.settings.disableConversations) {
            maxui.messaging.bind({
                action: 'add',
                object: 'message'
            }, function(message) {
                maxui.conversations.ReceiveMessage(message);
            });
            maxui.messaging.bind({
                action: 'add',
                object: 'conversation'
            }, function(message) {
                maxui.conversations.ReceiveConversation(message);
            });
            maxui.messaging.bind({
                action: 'refresh',
                object: 'conversation'
            }, function(message) {
                maxui.conversations.messagesview.load(message.destination);
            });
            maxui.messaging.bind({
                action: 'ack',
                object: 'message'
            }, function(message) {
                maxui.conversations.messagesview.ack(message);
            });
        }
        // Make settings available to utils package
        maxui.utils.setSettings(maxui.settings);
        /**
         *
         *
         **/
        jq.fn.hidePostboxActivity = function() {
            var maxui = this;
            if (maxui.settings.activitySource === 'timeline') {
                if (maxui.settings.subscriptionsWrite.length > 0) {
                    return maxui.settings.hidePostboxOnTimeline;
                }
            }
            for (var i in maxui.settings.subscriptionsWrite) {
                var hash = maxui.settings.subscriptionsWrite[i].hash;
                if (hash === maxui.settings.readContext) {
                    return maxui.settings.hidePostboxOnTimeline;
                }
            }
            return true;
        };
        // Get user data and start ui rendering when completed
        this.maxClient.getUserData(maxui.settings.username, function(data) {
            //Determine if user can write in writeContexts
            maxui.settings.displayName = data.displayName || maxui.settings.username;
            var userSubscriptions = {};
            var subscriptionsWrite = [];
            if (data.subscribedTo) {
                if (data.subscribedTo) {
                    if (data.subscribedTo.length > 0) {
                        for (var sc = 0; sc < data.subscribedTo.length; sc++) {
                            var subscription = data.subscribedTo[sc];
                            userSubscriptions[subscription.hash] = {};
                            userSubscriptions[subscription.hash].permissions = {};
                            for (var pm = 0; pm < subscription.permissions.length; pm++) {
                                var permission = subscription.permissions[pm];
                                userSubscriptions[subscription.hash].permissions[permission] = true;
                                if (permission === 'write') {
                                    subscriptionsWrite.push({
                                        hash: subscription.url,
                                        displayname: subscription.displayName
                                    });
                                }
                            }
                        }
                    }
                }
            }
            maxui.settings.subscriptionsWrite = subscriptionsWrite;
            maxui.settings.subscriptions = userSubscriptions;
            if (maxui.settings.activitySource === 'timeline' && subscriptionsWrite.length > 0) {
                maxui.settings.writeContexts.push(subscriptionsWrite[0].hash);
            }
            // Start messaging only if conversations enabled
            if (!maxui.settings.disableConversations) {
                maxui.messaging.start();
                jq(window).on('beforeunload', function(event) {
                    var x = maxui.messaging.disconnect();
                    return x;
                });
            }
            // render main interface
            var showCT = maxui.settings.UISection === 'conversations';
            var showTL = maxui.settings.UISection === 'timeline';
            var toggleTL = maxui.settings.disableTimeline === false && !showTL;
            var toggleCT = maxui.settings.disableConversations === false && !showCT;
            var containerWidth = maxui.width() - maxui.settings.scrollbarWidth;
            var showRecentOrder = maxui.settings.activitySortView === 'recent';
            var showLikesOrder = maxui.settings.activitySortView === 'likes';
            var showFlaggedOrder = maxui.settings.activitySortView === 'flagged';
            var params = {
                username: maxui.settings.username,
                literals: maxui.settings.literals,
                showMaxUIClass: showCT ? 'maxui-container-chat' : 'maxui-container-activity',
                showConversations: showCT ? 'display:block;' : 'display:none;',
                showConversationsToggle: toggleCT ? 'display:block;' : 'display:none;',
                showTimeline: showTL ? 'display:block;' : 'display:none;',
                showTimelineToggle: toggleTL ? 'display:block;' : 'display:none;',
                orderViewRecent: showRecentOrder ? 'active' : '',
                orderViewLikes: showLikesOrder ? 'active' : '',
                orderViewFlagged: showFlaggedOrder ? 'active' : '',
                messagesStyle: 'width:{0}px;left:{0}px;'.format(containerWidth),
                hidePostbox: maxui.hidePostboxActivity()
            };
            var mainui = maxui.templates.mainUIActivity.render(params);
            maxui.html(mainui);
            maxui.overlay = new max.views.MaxOverlay(maxui);
            // Define widths
            // XXX TODO :Read from renderer styles, not hardcoded values
            maxui.settings.widgetWidth = maxui.width();
            maxui.settings.sectionsWidth = maxui.settings.widgetWidth - maxui.settings.scrollbarWidth - maxui.settings.widgetBorder;
            // First-rendering of conversations list, even if it's not displayed on start
            if (!maxui.settings.disableConversations) {
                maxui.conversations.render();
                maxui.conversations.listview.load(data.talkingIn);
            }
            if (maxui.settings.UISection === 'conversations') {
                maxui.bindEventsActivity();
                maxui.toggleSectionActivity('conversations');
                maxui.renderPostboxActivity();
                var textarea_literal = maxui.settings.literals.new_conversation_text;
                jq('#maxuiactivity-widget-container #maxui-newactivity-box textarea').val(textarea_literal).attr('data-literal', textarea_literal);
            } else if (maxui.settings.UISection === 'timeline') {
                var sort_orders_by_view = {
                    recent: maxui.settings.activitySortOrder,
                    likes: 'likes',
                    flagged: 'flagged'
                };
                maxui.printActivitiesActivity({
                    sortBy: sort_orders_by_view[maxui.settings.activitySortView]
                }, function(event) {
                    maxui.bindEventsActivity();
                });
            }
        });
        // allow jq chaining
        return maxui;
    };
    jq.fn.bindEventsActivity = function() {
        var maxui = this;
        //Assign click to loadmore
        jq('#maxuiactivity-widget-container #maxui-more-activities .maxui-button').click(function(event) {
            event.preventDefault();
            maxui.loadMoreActivities();
            /*if (jq('#maxuiactivity-widget-container #maxui-search').hasClass('folded')) {
                maxui.loadMoreActivitiesActivity();
            } else {
                var last_result_id = jq('.maxui-activity:last').attr('id');
                maxui.reloadFiltersActivity(last_result_id);
            }*/
        });
        //PG Assign click to load news activities
        jq('#maxuiactivity-widget-container #maxui-news-activities .maxui-button').click(function(event) {
            maxui.loadNewsActivitiesActivity();
        });
        //Assign click to toggle search filters if any search filter defined
        jq('#maxuiactivity-widget-container #maxui-search-toggle').click(function(event) {
            event.preventDefault();
            if (!jq(this).hasClass('maxui-disabled')) {
                jq('#maxuiactivity-widget-container #maxui-search').toggleClass('folded');
                if (jq('#maxuiactivity-widget-container #maxui-search').hasClass('folded')) {
                    maxui.printActivitiesActivity({});
                } else {
                    maxui.reloadFiltersActivity();
                }
            }
        });
        //Assign Commentbox toggling via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-commentaction', function(event) {
            event.preventDefault();
            window.status = '';
            jq(this).closest('.maxui-activity').find('.maxui-comments').toggle(200);
        });
        //Assign Username and avatar clicking via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-actor', function(event) {
            event.preventDefault();
            var actor = jq(this).find('.maxui-username').text();
            maxui.addFilterActivity({
                type: 'actor',
                value: actor
            });
            jq('#maxuiactivity-widget-container #maxui-search').toggleClass('folded', false);
        });
        //Assign Username and avatar clicking via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-search').on('click', '#maxui-favorites-filter', function(event) {
            event.preventDefault();
            var favoritesButton = jq(event.currentTarget);
            var filterFavorites = !favoritesButton.hasClass('active');
            var valued_literal = '';
            var recent_literal = '';
            if (filterFavorites) {
                maxui.addFilterActivity({
                    type: 'favorites',
                    value: true,
                    visible: false
                });
                valued_literal = maxui.settings.literals.valued_favorited_activity;
                recent_literal = maxui.settings.literals.recent_favorited_activity;
            } else {
                maxui.delFilterActivity({
                    type: 'favorites',
                    value: true
                });
                valued_literal = maxui.settings.literals.valued_activity;
                recent_literal = maxui.settings.literals.recent_activity;
            }
            favoritesButton.toggleClass('active', filterFavorites);
            jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-most-recent').text(recent_literal);
            jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-most-valued').text(valued_literal);
        });
        //Assign hashtag filtering via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-hashtag', function(event) {
            event.preventDefault();
            maxui.addFilterActivity({
                type: 'hashtag',
                value: jq(this).attr('value')
            });
            jq('#maxuiactivity-widget-container #maxui-search').toggleClass('folded', false);
        });
        //Add to writeContexts selected subscription to post in it.
        jq('#maxuiactivity-widget-container #maxui-subscriptions').on('change', function() {
            var $urlContext = jq('#maxuiactivity-widget-container #maxui-subscriptions :selected').val();
            if ($urlContext !== 'timeline') {
                maxui.settings.writeContexts = [];
                maxui.settings.writeContextsHashes = [];
                // Add read context to write contexts
                maxui.settings.writeContexts.push($urlContext);
                // Store the hashes of the write contexts
                for (var wc = 0; wc < maxui.settings.writeContexts.length; wc++) {
                    maxui.settings.writeContextsHashes.push(maxui.utils.sha1(maxui.settings.writeContexts[wc]));
                }
            } else {
                maxui.settings.writeContexts = [];
                maxui.settings.writeContextsHashes = undefined;
            }
        });
        //Assign filter closing via delegating the click to the filters container
        jq('#maxuiactivity-widget-container #maxui-search-filters').on('click', '.maxui-close', function(event) {
            event.preventDefault();
            var filter = jq(this.parentNode.parentNode);
            maxui.delFilterActivity({
                type: filter.attr('type'),
                value: filter.attr('value')
            });
        });
        //Assign filter closing via delegating the click to the filters container
        jq('#maxuiactivity-widget-container #maxui-new-participants').on('click', '.maxui-close', function(event) {
            event.preventDefault();
            var filter = jq(this.parentNode.parentNode);
            maxui.delPersonActivity({
                username: filter.attr('username')
            });
        });
        //Assign filter closing via delegating the click to the filters container
        jq('#maxuiactivity-widget-container #maxui-new-displayName').on('keyup', 'input', function(event) {
            event.preventDefault();
            maxui.reloadPersonsActivity();
        });
        //Assign user mention suggestion to textarea by click
        jq('#maxuiactivity-widget-container #maxui-newactivity').on('click', '.maxui-prediction', function(event) {
            event.preventDefault();
            var $selected = jq(this);
            var $area = jq('#maxuiactivity-widget-container #maxui-newactivity-box textarea');
            var $predictive = jq('#maxuiactivity-widget-container #maxui-newactivity #maxui-predictive');
            var text = $area.val();
            var matchMention = new RegExp('^\\s*@([\\w\\.]+)');
            var replacement = text.replace(matchMention, '@' + $selected.text() + ' ');
            $predictive.hide();
            $area.val(replacement);
            $area.focus();
        });
        // Close predictive window if clicked outside
        jq(document).on('click', function(event) {
            var $predictive = jq('.maxui-predictive');
            $predictive.hide();
        });
        //Assign user mention suggestion to input by click
        jq('#maxuiactivity-widget-container #maxui-conversation-predictive').on('click', '.maxui-prediction', function(event) {
            event.preventDefault();
            var $selected = jq(this);
            var $area = jq('#maxuiactivity-widget-container #maxui-add-people-box .maxui-text-input');
            var $predictive = jq('#maxuiactivity-widget-container #maxui-conversation-predictive');
            var username = $selected.attr('data-username');
            var displayname = $selected.attr('data-displayname');
            maxui.addPersonActivity({
                'username': username,
                'displayName': displayname
            });
            $predictive.hide();
            $area.val('').focus();
        });
        //Assign toggling conversations section
        jq('#maxuiactivity-widget-container #maxui-show-conversations').on('click', function(event) {
            event.preventDefault();
            window.status = '';
            maxui.toggleSectionActivity('conversations');
        });
        //Assign activation of timeline section by its button
        jq('#maxuiactivity-widget-container #maxui-show-timeline').on('click', function(event) {
            event.preventDefault();
            window.status = '';
            maxui.printActivitiesActivity({}, function(event) {
                maxui.toggleSectionActivity('timeline');
            });
        });
        //Toggle favorite status via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-action.maxui-favorites', function(event) {
            event.preventDefault();
            var $favorites = jq(this);
            var $activity = jq(this).closest('.maxui-activity');
            var activityid = $activity.attr('id');
            var favorited = $favorites.hasClass('maxui-favorited');
            if (favorited) {
                maxui.maxClient.unfavoriteActivity(activityid, function(event) {
                    $favorites.toggleClass('maxui-favorited', false);
                });
            } else {
                maxui.maxClient.favoriteActivity(activityid, function(event) {
                    $favorites.toggleClass('maxui-favorited', true);
                });
            }
        });
        //Toggle like status via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-action.maxui-likes', function(event) {
            event.preventDefault();
            var $likes = jq(this);
            var $activity = jq(this).closest('.maxui-activity');
            var activityid = $activity.attr('id');
            var liked = $likes.hasClass('maxui-liked');
            var $likes_count = $likes.children('strong');
            if (liked) {
                maxui.maxClient.unlikeActivity(activityid, function(event) {
                    $likes.toggleClass('maxui-liked', false);
                });
                $likes_count.text(parseInt($likes_count.text(), 10) - 1);
            } else {
                maxui.maxClient.likeActivity(activityid, function(event) {
                    $likes.toggleClass('maxui-liked', true);
                });
                $likes_count.text(parseInt($likes_count.text(), 10) + 1);
            }
        });
        //Toggle flagged status via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-action.maxui-flag', function(event) {
            event.preventDefault();
            var $flag = jq(this);
            var $activity = jq(this).closest('.maxui-activity');
            var activityid = $activity.attr('id');
            var flagged = $flag.hasClass('maxui-flagged');
            if (flagged) {
                maxui.maxClient.unflagActivity(activityid, function(event) {
                    $flag.toggleClass('maxui-flagged', false);
                    $activity.toggleClass('maxui-flagged', false);
                    maxui.printActivitiesActivity({});
                });
            } else {
                maxui.maxClient.flagActivity(activityid, function(event) {
                    $flag.toggleClass('maxui-flagged', true);
                    $activity.toggleClass('maxui-flagged', false);
                    maxui.printActivitiesActivity({});
                });
            }
        });
        //Assign activity removal confirmation dialog toggle via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-action.maxui-delete', function(event) {
            event.preventDefault();
            var $activity = jq(this).closest('.maxui-activity');
            var $dialog = $activity.find('.maxui-actions > .maxui-popover');
            if (!$dialog.is(':visible')) {
                jq('.maxui-popover').css({
                    opacity: 0
                }).hide();
                $dialog.show();
                $dialog.animate({
                    opacity: 1
                }, 300);
            } else {
                $dialog.animate({
                    opacity: 0
                }, 300);
                jq('.maxui-popover').css({
                    opacity: 0
                }).hide();
            }
        });
        //Assign activity removal confirmation dialog via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-actions .maxui-button-cancel', function(event) {
            event.preventDefault();
            // Hide all visible dialogs
            var $popover = jq('.maxui-popover:visible').css({
                opacity: 0
            });
            $popover.hide();
        });
        //Assign activity removal via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-actions .maxui-button-delete', function(event) {
            event.preventDefault();
            var $activity = jq(this).closest('.maxui-activity');
            var activityid = $activity.attr('id');
            maxui.maxClient.removeActivity(activityid, function(event) {
                var $popover = jq('.maxui-popover:visible').animate({
                    opacity: 0
                }, 300);
                $activity.css({
                    height: $activity.height(),
                    'min-height': 'auto'
                });
                $activity.animate({
                    height: 0,
                    opacity: 0
                }, 100, function(event) {
                    $activity.remove();
                    $popover.hide();
                });
            });
        });
        //Assign activity comment removal confirmation dialog toggle via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-delete-comment', function(event) {
            event.preventDefault();
            var $comment = jq(this).closest('.maxui-comment');
            var $dialog = $comment.find('.maxui-popover');
            if (!$dialog.is(':visible')) {
                jq('.maxui-popover').css({
                    opacity: 0
                }).hide();
                $dialog.show();
                $dialog.animate({
                    opacity: 1
                }, 300);
            } else {
                $dialog.animate({
                    opacity: 0
                }, 300);
                jq('.maxui-popover').css({
                    opacity: 0
                }).hide();
            }
        });
        //Assign activity comment removal confirmation dialog via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-comment .maxui-button-cancel', function(event) {
            event.preventDefault();
            var $popover = jq('.maxui-popover').css({
                opacity: 0
            });
            $popover.hide();
        });
        //Assign activity comment removal via delegating the click to the activities container
        jq('#maxuiactivity-widget-container #maxui-activities').on('click', '.maxui-comment .maxui-button-delete', function(event) {
            event.preventDefault();
            var $comment = jq(this).closest('.maxui-comment');
            var $activity = $comment.closest('.maxui-activity');
            var activityid = $activity.attr('id');
            var commentid = $comment.attr('id');
            maxui.maxClient.removeActivityComment(activityid, commentid, function() {
                var $popover = jq('.maxui-popover').animate({
                    opacity: 0
                }, 300);
                $comment.css({
                    height: $activity.height(),
                    'min-height': 'auto'
                });
                $comment.animate({
                    height: 0,
                    opacity: 0
                }, 100, function(event) {
                    $comment.remove();
                    $popover.hide();
                });
            });
        });
        jq('#maxuiactivity-widget-container #maxui-activity-sort').on('click', 'a.maxui-sort-action.maxui-most-recent', function(event) {
            event.preventDefault();
            var $sortbutton = jq(this);
            if (!$sortbutton.hasClass('active')) {
                jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-sort-action.active').toggleClass('active', false);
                $sortbutton.toggleClass('active', true);
                maxui.printActivitiesActivity({});
            }
        });
        jq('#maxuiactivity-widget-container #maxui-activity-sort').on('click', 'a.maxui-sort-action.maxui-most-valued', function(event) {
            event.preventDefault();
            var $sortbutton = jq(this);
            if (!$sortbutton.hasClass('active')) {
                jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-sort-action.active').toggleClass('active', false);
                $sortbutton.toggleClass('active', true);
                maxui.printActivitiesActivity({
                    sortBy: 'likes'
                });
            }
        });
        jq('#maxuiactivity-widget-container #maxui-activity-sort').on('click', 'a.maxui-sort-action.maxui-flagged', function(event) {
            event.preventDefault();
            var $sortbutton = jq(this);
            if (!$sortbutton.hasClass('active')) {
                jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-sort-action.active').toggleClass('active', false);
                $sortbutton.toggleClass('active', true);
                maxui.printActivitiesActivity({
                    sortBy: 'flagged'
                });
            }
        });
        // **************************************************************************************
        //                    add people predicting
        // **************************************************************************************
        var selector = '.maxui-text-input';
        jq('#maxuiactivity-widget-container #maxui-add-people-box').on('focusin', selector, function(event) {
            event.preventDefault();
            var text = jq(this).val();
            var literal = jq(this).attr('data-literal');
            var normalized = maxui.utils.normalizeWhiteSpace(text, false);
            if (normalized === literal) {
                jq(this).val('');
            }
        }).on('keydown', selector, function(event) {
            if (jq('#maxuiactivity-widget-container #maxui-conversation-predictive:visible').length > 0 && (event.which === 40 || event.which === 38 || event.which === 13 || event.which === 9)) {
                maxui.utils.freezeEvent(event);
            }
        }).on('keyup', selector, function(event) {
            event.preventDefault();
            event.stopPropagation();
            var text = jq(this).val();
            var normalized = maxui.utils.normalizeWhiteSpace(text, false);
            if (normalized === '') {
                jq(this).attr('class', 'maxui-empty maxui-text-input');
                jq(this).removeAttr('title');
            } else {
                if (maxui.settings.canwrite) {
                    jq(this).attr('class', 'maxui-text-input');
                }
            }
            var key = event.which;
            var matchMention = new RegExp('^\\s*([\\u00C0-\\u00FC\\w\\. ]+)\\s*');
            var match = text.match(matchMention);
            var matchMentionEOL = new RegExp('^\\s*([\\u00C0-\\u00FC\\w\\. ]+)\\s*$');
            var matchEOL = text.match(matchMentionEOL);
            var $selected = jq('#maxuiactivity-widget-container #maxui-conversation-predictive .maxui-prediction.selected');
            var $area = jq(this);
            var $predictive = jq('#maxuiactivity-widget-container #maxui-conversation-predictive');
            var num_predictions = $predictive.find('.maxui-prediction').length;
            var is_predicting = jq('#maxuiactivity-widget-container #maxui-conversation-predictive:visible').length > 0;
            // Up & down
            if (key === 40 && is_predicting && num_predictions > 1) {
                var $next = $selected.next();
                $selected.removeClass('selected');
                if ($next.length > 0) {
                    $next.addClass('selected');
                } else {
                    $selected.siblings(':first').addClass('selected');
                }
            } else if (key === 38 && is_predicting && num_predictions > 1) {
                var $prev = $selected.prev();
                $selected.removeClass('selected');
                if ($prev.length > 0) {
                    $prev.addClass('selected');
                } else {
                    $selected.siblings(':last').addClass('selected');
                }
            } else if (key === 27) {
                $predictive.hide();
            } else if ((key === 13 || key === 9) && is_predicting) {
                var username = $selected.attr('data-username');
                var displayname = $selected.attr('data-displayname');
                maxui.addPersonActivity({
                    'username': username,
                    'displayName': displayname
                });
                $predictive.hide();
                $area.val('').focus();
            } else //1
            {
                if (maxui.settings.conversationsSection === 'conversations') {
                    if (match) {
                        $area.attr('class', 'maxui-text-input');
                        if (matchEOL) {
                            $predictive.show();
                            $predictive.html('<ul></ul>');
                            maxui.printPredictionsActivity(match[1], '#maxui-conversation-predictive');
                        }
                    } else {
                        $predictive.hide();
                        $area.attr('class', 'maxui-empty maxui-text-input');
                        if (!text.match(new RegExp('^\\s*@'))) {
                            $area.attr('class', 'maxui-text-input error');
                            $area.attr('title', maxui.settings.literals.post_permission_not_here);
                        }
                    }
                }
            } //1
        }).on('focusout', selector, function(event) {
            event.preventDefault();
            var text = jq(this).val();
            var literal = jq(this).attr('data-literal');
            var normalized = maxui.utils.normalizeWhiteSpace(text, false);
            if (normalized === '') {
                jq(this).val(literal);
            }
        });
        // **************************************************************************************
        //Assign Activity post action And textarea behaviour
        maxui.bindActionBehaviourActivity('#maxui-newactivity', '#maxui-newactivity-box', {}, function(text) {
            if (maxui.settings.UISection === 'timeline') {
                maxui.sendActivityActivity(text);
                jq('#maxuiactivity-widget-container #maxui-search').toggleClass('folded', true);
            } else if (maxui.settings.UISection === 'conversations') {
                if (maxui.settings.conversationsSection === 'conversations') {
                    var participants_box = jq('#maxuiactivity-widget-container #maxui-new-participants')[0];
                    var participants = [];
                    for (var i = 0; i < participants_box.people.length; i++) {
                        participants.push(participants_box.people[i].username);
                    }
                    var message = jq('#maxuiactivity-widget-container #maxui-newactivity textarea').val();
                    var options = {
                        participants: participants,
                        message: message
                    };
                    if (participants.length > 1) {
                        var displayName = jq('#maxuiactivity-widget-container #maxui-add-people-box #maxui-new-displayName input').val();
                        options.displayName = displayName;
                    }
                    maxui.conversations.create(options);
                } else {
                    maxui.conversations.send(text);
                }
            }
        }, function(text, area, button, ev) {
            var key = ev.which;
            var matchMention = new RegExp('^\\s*@([\\w\\.]+)\\s*');
            var match = text.match(matchMention);
            var matchMentionEOL = new RegExp('^\\s*@([\\w\\.]+)\\s*$');
            var matchEOL = text.match(matchMentionEOL);
            var $selected = jq('#maxuiactivity-widget-container #maxui-newactivity .maxui-prediction.selected');
            var $area = jq(area);
            var $predictive = jq('#maxuiactivity-widget-container #maxui-newactivity #maxui-predictive');
            var num_predictions = $predictive.find('.maxui-prediction').length;
            var is_predicting = jq('#maxuiactivity-widget-container #maxui-newactivity #maxui-predictive:visible').length > 0;
            // Up & down
            if (key === 40 && is_predicting && num_predictions > 1) {
                var $next = $selected.next();
                $selected.removeClass('selected');
                if ($next.length > 0) {
                    $next.addClass('selected');
                } else {
                    $selected.siblings(':first').addClass('selected');
                }
            } else if (key === 38 && is_predicting && num_predictions > 1) {
                var $prev = $selected.prev();
                $selected.removeClass('selected');
                if ($prev.length > 0) {
                    $prev.addClass('selected');
                } else {
                    $selected.siblings(':last').addClass('selected');
                }
            } else if (key === 27) {
                $predictive.hide();
            } else if ((key === 13 || key === 9) && is_predicting) {
                var matchMention2 = new RegExp('^\\s*@([\\w\\.]+)');
                var replacement = text.replace(matchMention2, '@' + $selected.text() + ' ');
                $predictive.hide();
                $area.val(replacement).focus();
            } else if (text === '') {
                if (maxui.settings.UISection === 'timeline') {
                    jq(button).val(maxui.settings.literals.new_activity_post);
                }
            } else //1
            {
                if (maxui.settings.UISection === 'timeline') {
                    if (match) {
                        jq(button).val(maxui.settings.literals.new_message_post);
                        if (matchEOL) {
                            $predictive.show();
                            $predictive.html('<ul></ul>');
                            maxui.printPredictionsActivity(match[1], '#maxui-newactivity #maxui-predictive');
                        }
                        jq(button).removeAttr('disabled');
                        jq(button).attr('class', 'maxui-button');
                        $area.attr('class', 'maxui-text-input');
                    } else {
                        jq(button).val(maxui.settings.literals.new_activity_post);
                        $predictive.hide();
                        if (!text.match(new RegExp('^\\s*@')) && !maxui.settings.canwrite) {
                            $area.attr('class', 'maxui-text-input error');
                            $area.attr('title', maxui.settings.literals.post_permission_unauthorized);
                        }
                    }
                } else if (maxui.settings.UISection === 'conversations') {
                    if (maxui.settings.conversationsSection === 'conversations') {
                        maxui.reloadPersonsActivity();
                    } else if (maxui.settings.conversationsSection === 'messages') {
                        $predictive.hide();
                        jq(button).removeAttr('disabled');
                        jq(button).attr('class', 'maxui-button');
                        $area.attr('class', 'maxui-text-input');
                    }
                } //elseif
            } //1
        }); //function;
        //Assign Commentbox send comment action And textarea behaviour
        maxui.bindActionBehaviourActivity('#maxuiactivity-widget-container #maxui-activities', '.maxui-newcommentbox', {}, function(text) {
            var activityid = jq(this).closest('.maxui-activity').attr('id');
            maxui.maxClient.addComment(text, activityid, function() {
                jq('#maxuiactivity-widget-container #activityContainer textarea').val('');
                var activity_id = this.object.inReplyTo[0].id;
                maxui.printCommentsForActivityActivity(activity_id);
                jq('#maxuiactivity-widget-container #' + activity_id + ' .maxui-newcommentbox textarea').val('');
                jq('#maxuiactivity-widget-container #' + activity_id + ' .maxui-newcommentbox .maxui-button').attr('disabled', 'disabled');
            });
        });
        //Assign Search box search action And input behaviour
        maxui.bindActionBehaviourActivity('#maxuiactivity-widget-container #maxui-search', '#maxui-search-box', {}, function(text) {
            maxui.textSearchActivity(text);
            jq('#maxuiactivity-widget-container #maxui-search').toggleClass('folded', false);
            jq('#maxuiactivity-widget-container #maxui-search-text').val('');
        });
        // // Execute search if <enter> pressed
        // jq('#maxuiactivity-widget-container #maxui-search .maxui-text-input').keyup(function(e) {
        //           if (e.keyCode === 13) {
        //              maxui.textSearchActivity(jq(this).attr('value'))
        //              jq('#maxuiactivity-widget-container #maxui-search').toggleClass('folded',false)
        //           }
        // });
    };
    /**
     *    Takes a  button-input pair identified by 'maxui-button' and 'maxui-text-input'
     *    classes respectively, contained in a container and applies focusin/out
     *    and clicking behaviour
     *
     *    @param {String} delegate         CSS selector identifying the parent container on which to delegate events
     *    @param {String} target           CSS selector identifying the direct container on which execute events
     *    @param {object} options          Extra options, currently ignore-button, to avoid button updates
     *    @param {Function} clickFunction  Function to execute when click on the button
     **/
    jq.fn.bindActionBehaviourActivity = function(delegate, target, options, clickFunction) {
        // Clear input when focusing in only if user hasn't typed anything yet
        var maxui = this;
        var selector = target + ' .maxui-text-input';
        var extra_bind = null;
        if (arguments.length > 4) {
            extra_bind = arguments[4];
        }
        jq(delegate).on('focusin', selector, function(event) {
            event.preventDefault();
            var text = jq(this).val();
            var literal = jq(this).attr('data-literal');
            var normalized = maxui.utils.normalizeWhiteSpace(text, false);
            if (normalized === literal) {
                jq(this).val('');
            }
        }).on('keydown', selector, function(event) {
            if (jq(delegate + ' #maxui-predictive:visible').length > 0 && (event.which === 40 || event.which === 38 || event.which === 13 || event.which === 9)) {
                maxui.utils.freezeEvent(event);
            } else if (event.which === 13 && event.shiftKey === false && !options.ignore_button) {
                event.preventDefault();
                var $area = jq(this).parent().find('.maxui-text-input');
                var literal = $area.attr('data-literal');
                var text = $area.val();
                var normalized = maxui.utils.normalizeWhiteSpace(text, false);
                if (normalized !== literal & normalized !== '') {
                    clickFunction.apply(this, [text]);
                }
            }
        }).on('keyup', selector, function(event) {
            event.preventDefault();
            event.stopPropagation();
            var text = jq(this).val();
            var button = jq(this).parent().parent().find('.maxui-button');
            var normalized = maxui.utils.normalizeWhiteSpace(text, false);
            if (normalized === '' && !options.ignore_button) {
                jq(button).attr('disabled', 'disabled');
                jq(button).attr('class', 'maxui-button maxui-disabled');
                jq(this).attr('class', 'maxui-empty maxui-text-input');
                jq(this).removeAttr('title');
            } else {
                if (maxui.settings.canwrite && !options.ignore_button) {
                    jq(button).removeAttr('disabled');
                    jq(button).attr('class', 'maxui-button');
                    jq(this).attr('class', 'maxui-text-input');
                }
            }
            if (extra_bind !== null) {
                extra_bind(text, this, button, event);
            }
        }).on('paste', selector, function(event) {
            var button = jq(this).parent().parent().find('.maxui-button');
            if (maxui.settings.canwrite && !options.ignore_button) {
                jq(button).removeAttr('disabled');
                jq(button).attr('class', 'maxui-button');
                jq(this).attr('class', 'maxui-text-input');
            }
            var text = jq(this).val();
            if (extra_bind !== null) {
                extra_bind(text, this, button, event);
            }
        }).on('focusout', selector, function(event) {
            event.preventDefault();
            var text = jq(this).val();
            var literal = jq(this).attr('data-literal');
            var normalized = maxui.utils.normalizeWhiteSpace(text, false);
            if (normalized === '') {
                jq(this).val(literal);
            }
            /*        }).on('mousedown', selector, function(event) {
                        event.preventDefault();
                        if (event.which == 3) {
                            debugger
                        }*/
        }).on('click', target + ' .maxui-button', function(event) {
            event.preventDefault();
            var $area = jq(this).parent().find('.maxui-text-input');
            var literal = $area.attr('data-literal');
            var text = $area.val();
            var normalized = maxui.utils.normalizeWhiteSpace(text, false);
            if ((normalized !== literal & normalized !== '') || options.empty_click) {
                clickFunction.apply(this, [text]);
            }
        });
    };
    /**
     *    Updates the search filters with a new collection of keywords/hashtags extracted of
     *    a user-entered text, and reloads the search query. Identifies special characters
     *    at the first position of each keyword to identify keyword type
     *
     *    @param {String} text    A string containing whitespace-separated keywords/#hashtags
     **/
    jq.fn.textSearchActivity = function(text) {
        var maxui = this;
        //Normalize spaces
        var normalized = maxui.utils.normalizeWhiteSpace(text);
        var keywords = normalized.split(' ');
        for (var kw = 0; kw < keywords.length; kw++) {
            var kwtype = 'keyword';
            var keyword = keywords[kw];
            switch (keyword[0]) {
                case '#':
                    kwtype = 'hashtag';
                    keyword = keyword.substr(1);
                    break;
                case '@':
                    kwtype = 'actor';
                    keyword = keyword.substr(1);
                    break;
                default:
                    kwtype = 'keyword';
                    break;
            }
            if (keyword.length >= 3) {
                this.addFilterActivity({
                    type: kwtype,
                    value: keyword
                }, false);
            }
        }
        this.reloadFiltersActivity();
    };
    /**
     *    Prepares a object with the current active filters
     *
     *    @param {String} (optional)    A string containing the id of the last activity loaded
     **/
    jq.fn.getFiltersActivity = function() {
        var maxui = this;
        var params = {
            filters: maxui.filters
        };
        if (params.filters === undefined) {
            params.filters = [];
        }
        var filters = {};
        // group filters
        var enableSearchToggle = false;
        for (var f = 0; f < params.filters.length; f++) {
            var filter = params.filters[f];
            // Enable toggle button only if there's at least one visible filter
            if (filter.visible) {
                enableSearchToggle = true;
            }
            if (!filters[filter.type]) {
                filters[filter.type] = [];
            }
            filters[filter.type].push(filter.value);
        }
        // Accept a optional parameter indicating search start point
        if (arguments.length > 0) {
            filters.before = arguments[0];
        }
        return {
            filters: filters,
            visible: enableSearchToggle
        };
    };
    /**
     *    Reloads the current filters UI and executes the search, optionally starting
     *    at a given point of the timeline
     *
     *    @param {String} (optional)    A string containing the id of the last activity loaded
     **/
    jq.fn.reloadFiltersActivity = function() {
        var maxui = this;
        var filters;
        var params = {
            filters: maxui.filters
        };
        var activity_items = maxui.templates.filters.render(params);
        jq('#maxuiactivity-widget-container #maxui-search-filters').html(activity_items);
        // Accept a optional parameter indicating search start point
        if (arguments.length > 0) {
            filters = maxui.getFiltersActivity(arguments[0]);
        } else {
            filters = maxui.getFiltersActivity();
        }
        maxui.printActivitiesActivity({});
        //Enable or disable filter toogle if there are visible filters defined (or not)
        jq('#maxuiactivity-widget-container #maxui-search').toggleClass('folded', !filters.visible);
    };
    /**
     *    Adds a new filter to the search if its not present
     *    @param {Object} filter    An object repesenting a filter, with the keys "type" and "value"
     **/
    jq.fn.delFilterActivity = function(filter) {
        var maxui = this;
        var deleted = false;
        for (var i = 0; i < maxui.filters.length; i++) {
            if (maxui.filters[i].value === filter.value & maxui.filters[i].type === filter.type) {
                deleted = true;
                maxui.filters.splice(i, 1);
            }
        }
        if (deleted) {
            this.reloadFiltersActivity();
        }
    };
    /**
     *    Adds a new filter to the search if its not present
     *    @param {Object} filter    An object repesenting a filter, with the keys "type" and "value"
     **/
    jq.fn.addFilterActivity = function(filter) {
        var maxui = this;
        var reload = true;
        //Reload or not by func argument
        if (arguments.length > 1) {
            reload = arguments[1];
        }
        if (!maxui.filters) {
            maxui.filters = [];
        }
        // show filters bu default unless explicitly specified on filter argument
        if (!filter.hasOwnProperty('visible')) {
            filter.visible = true;
        }
        switch (filter.type) {
            case "hashtag":
                filter.prepend = '#';
                break;
            case "actor":
                filter.prepend = '@';
                break;
            default:
                filter.prepend = '';
                break;
        }
        var already_filtered = false;
        for (var i = 0; i < maxui.filters.length; i++) {
            if (maxui.filters[i].value === filter.value & maxui.filters[i].type === filter.type) {
                already_filtered = true;
            }
        }
        if (!already_filtered) {
            maxui.filters.push(filter);
            if (reload === true) {
                this.reloadFiltersActivity();
            }
        }
    };
    /**
     *    Reloads the current filters UI and executes the search, optionally starting
     *    at a given point of the timeline
     *
     *    @param {String} (optional)    A string containing the id of the last activity loaded
     **/
    jq.fn.reloadPersonsActivity = function() {
        var maxui = this;
        var $participants_box = jq('#maxuiactivity-widget-container #maxui-new-participants');
        var participants_box = $participants_box[0];
        if (!participants_box.people) {
            participants_box.people = [];
        }
        var $button = jq('#maxuiactivity-widget-container #maxui-newactivity input.maxui-button');
        var $newmessagebox = jq('#maxuiactivity-widget-container #maxui-newactivity');
        var message = $newmessagebox.find('textarea').val();
        var placeholder = $newmessagebox.find('textarea').attr('data-literal');
        message = maxui.utils.normalizeWhiteSpace(message);
        var $newdisplaynamebox = jq('#maxuiactivity-widget-container #maxui-add-people-box #maxui-new-displayName');
        var displayName = $newdisplaynamebox.find('input').val();
        displayName = maxui.utils.normalizeWhiteSpace(displayName);
        var params = {
            persons: participants_box.people
        };
        var participants_items = maxui.templates.participants.render(params);
        jq('#maxuiactivity-widget-container #maxui-new-participants').html(participants_items);
        jq('#maxuiactivity-widget-container #maxui-add-people-box .maxui-label .maxui-count').text('({0}/{1})'.format(participants_box.people.length + 1, maxui.settings.maximumConversations));
        if (participants_box.people.length > 0) {
            var has_more_than_one_participant = participants_box.people.length > 1;
            var has_a_displayname = displayName !== '';
            if (has_more_than_one_participant && !has_a_displayname) {
                $button.attr('disabled', 'disabled');
                $button.attr('class', 'maxui-button maxui-disabled');
                if (displayName === '') {
                    $newmessagebox.find('textarea').attr('class', 'maxui-text-input error');
                    $newmessagebox.find('.maxui-error-box').text(maxui.settings.literals.post_permission_missing_displayName);
                    $newmessagebox.find('.maxui-error-box').width($newmessagebox.find('textarea').width() - 4);
                    $newmessagebox.find('.maxui-error-box').animate({
                        'bottom': -25
                    }, 200);
                }
            } else {
                $button.removeAttr('disabled');
                $button.attr('class', 'maxui-button');
                $newmessagebox.find('textarea').attr('class', 'maxui-text-input');
                $newmessagebox.find('.maxui-error-box').width($newmessagebox.find('textarea').width() - 4);
                $newmessagebox.find('.maxui-error-box').animate({
                    'bottom': 0
                }, 200);
            }
            $participants_box.show();
            $newmessagebox.show();
            if (participants_box.people.length > 1) {
                $newdisplaynamebox.show();
            } else {
                $newdisplaynamebox.hide();
                $newdisplaynamebox.find('.maxui-text-input').val('');
            }
        } else if (message !== '' && message !== placeholder) {
            $button.attr('disabled', 'disabled');
            $button.attr('class', 'maxui-button maxui-disabled');
            $participants_box.hide();
            $newmessagebox.find('textarea').attr('class', 'maxui-text-input error');
            $newmessagebox.find('.maxui-error-box').text(maxui.settings.literals.post_permission_not_enough_participants);
            $newmessagebox.find('.maxui-error-box').width($newmessagebox.find('textarea').width() - 4);
            $newmessagebox.find('.maxui-error-box').animate({
                'bottom': -25
            }, 200);
            $newdisplaynamebox.hide();
            $newdisplaynamebox.find('.maxui-text-input').val('');
        }
    };
    /**
     *    Removes a person from the list of new conversation
     *    @param {String} person    A String representing a user's username
     **/
    jq.fn.delPersonActivity = function(person) {
        var deleted = false;
        var participants_box = jq('#maxuiactivity-widget-container #maxui-new-participants')[0];
        for (var i = 0; i < participants_box.people.length; i++) {
            if (participants_box.people[i].username === person.username) {
                deleted = true;
                participants_box.people.splice(i, 1);
            }
        }
        if (deleted) {
            this.reloadPersonsActivity();
        }
    };
    /**
     *    Adds a new person to the list of new conversation
     *    @param {String} person    A String representing a user's username
     **/
    jq.fn.addPersonActivity = function(person) {
        var maxui = this;
        var participants_box = jq('#maxuiactivity-widget-container #maxui-new-participants')[0];
        var reload = true;
        //Reload or not by func argument
        if (arguments.length > 1) {
            reload = arguments[1];
        }
        var already_filtered = false;
        if (!participants_box.people) {
            participants_box.people = [];
        }
        if (person.username !== maxui.settings.username && participants_box.people.length < (maxui.settings.maximumConversations - 1)) {
            for (var i = 0; i < participants_box.people.length; i++) {
                if (participants_box.people[i].username === person.username) {
                    already_filtered = true;
                }
            }
            if (!already_filtered) {
                participants_box.people.push(person);
                if (reload === true) {
                    this.reloadPersonsActivity();
                }
            }
        }
    };
    /**
     *    Toggles between main sections
     **/
    jq.fn.toggleSectionActivity = function(sectionToEnable) {
        var maxui = this;
        var textarea_literal;
        var $search = jq('#maxuiactivity-widget-container #maxui-search');
        var $activitysort = jq('#maxuiactivity-widget-container #maxui-activity-sort');
        var $timeline = jq('#maxuiactivity-widget-container #maxui-timeline');
        var $timeline_wrapper = jq('#maxuiactivity-widget-container #maxui-timeline .maxui-wrapper');
        var $conversations = jq('#maxuiactivity-widget-container #maxui-conversations');
        var $common_header = jq('#maxuiactivity-widget-container #maxui-common-header');
        var $conversations_user_input = $conversations.find('input#add-user-input');
        var $conversations_list = jq('#maxuiactivity-widget-container #maxui-conversations #maxui-conversations-list');
        var $conversations_wrapper = jq('#maxuiactivity-widget-container #maxui-conversations .maxui-wrapper');
        var $postbutton = jq('#maxuiactivity-widget-container #maxui-newactivity-box .maxui-button');
        var $subscriptionsSelect = jq('#maxuiactivity-widget-container #maxui-newactivity-box #maxui-subscriptions');
        var $postbox = jq('#maxuiactivity-widget-container #maxui-newactivity');
        var $postbox_text = jq('#maxuiactivity-widget-container #maxui-newactivity-box textarea');
        var $conversationsbutton = jq('#maxuiactivity-widget-container #maxui-show-conversations');
        var $timelinebutton = jq('#maxuiactivity-widget-container #maxui-show-timeline');
        var $addpeople = jq('#maxuiactivity-widget-container #maxui-add-people-box');
        // Real width of the widget, without the two 1-pixel borders;
        var widgetWidth = maxui.width();
        var sectionPadding = 10;
        var widgetBorder = 1;
        var sectionsWidth = widgetWidth - maxui.conversations.scrollbar.width - (sectionPadding * 2) - (widgetBorder * 2);
        var height = 320;
        if (sectionToEnable === 'conversations' && maxui.settings.currentConversationSection === 'conversations') {
            $subscriptionsSelect.attr('style', 'display:none;');
            $conversations.show();
            $common_header.removeClass('maxui-showing-messages').addClass('maxui-showing-conversations');
            $addpeople.show();
            $conversations_user_input.focus();
            $conversations.animate({
                'height': height
            }, 400, function(event) {
                $conversations_wrapper.height(height);
            });
            $conversations_list.width(sectionsWidth);
            $timeline.animate({
                'height': 0
            }, 400);
            $search.hide(400);
            $activitysort.hide(400);
            maxui.settings.UISection = 'conversations';
            $postbutton.val(maxui.settings.literals.new_message_post);
            textarea_literal = maxui.settings.literals.new_conversation_text;
            $postbox_text.val(textarea_literal).attr('data-literal', textarea_literal);
            $conversationsbutton.hide();
            if (!maxui.settings.disableTimeline) {
                $timelinebutton.show();
            }
            maxui.conversations.scrollbar.setHeight(height - 45);
            maxui.conversations.scrollbar.setTarget('#maxui-conversations #maxui-conversations-list');
            $postbox.show();
        }
        if (sectionToEnable === 'timeline') {
            if (maxui.settings.showSubscriptionList === true) {
                $subscriptionsSelect.attr('style', 'display:inline;');
            }
            maxui.conversations.listview.toggle();
            $timeline.show();
            var timeline_height = $timeline_wrapper.height();
            $timeline.animate({
                'height': timeline_height
            }, 400, function(event) {
                $timeline.css('height', '');
            });
            $conversations.animate({
                'height': 0
            }, 400, function(event) {
                $conversations.hide();
                $addpeople.hide();
            });
            $search.show(400);
            $activitysort.show(400);
            maxui.settings.UISection = 'timeline';
            $postbutton.val(maxui.settings.literals.new_activity_post);
            textarea_literal = maxui.settings.literals.new_activity_text;
            $postbox_text.val(textarea_literal).attr('data-literal', textarea_literal);
            if (!maxui.settings.disableConversations) {
                $conversationsbutton.show();
            }
            $timelinebutton.hide();
            if (maxui.settings.hidePostboxOnTimeline) {
                $postbox.hide();
            }
            if (maxui.hidePostboxActivity()) {
                $postbox.hide();
            }
        }
    };
    /**
     *    Returns the current settings of the plugin
     **/
    jq.fn.Settings = function() {
        var maxui = this;
        return maxui.settings;
    };
    /**
     *    Sends a post when user clicks `post activity` button with
     *    the current contents of the `maxui-newactivity` textarea
     **/
    jq.fn.sendActivityActivity = function() {
        var maxui = this;
        var text = jq('#maxuiactivity-widget-container #maxui-newactivity textarea').val();
        var func_params = [];
        // change to recent view before posting
        jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-sort-action.active').toggleClass('active', false);
        jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-sort-action.maxui-most-recent').toggleClass('active', true);
        func_params.push(text);
        func_params.push(maxui.settings.writeContexts);
        func_params.push(function() {
            jq('#maxuiactivity-widget-container #maxui-newactivity textarea').val('');
            jq('#maxuiactivity-widget-container #maxui-newactivity .maxui-button').attr('disabled', 'disabled');
            var first = jq('.maxui-activity:first');
            if (first.length > 0) {
                var filter = {
                    after: first.attr('id')
                };
                maxui.printActivitiesActivity(filter);
            } else {
                maxui.printActivitiesActivity({});
            }
        });
        //Pass generator to activity post if defined
        if (maxui.settings.generatorName) {
            func_params.push(maxui.settings.generatorName);
        }
        var activityAdder = maxui.maxClient.addActivity;
        activityAdder.apply(maxui.maxClient, func_params);
        jq('#maxui-subscriptions option:first-child').attr("selected", "selected");
    };
    /**
     *    Loads more activities from max posted earlier than
     *    the oldest loaded activity
     **/
    jq.fn.loadMoreActivitiesActivity = function() {
        var maxui = this;
        var lastActivity = jq('.maxui-activity:last').attr('id');
        if (jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-sort-action.maxui-most-recent').hasClass('active')) {
            if (jq("#" + lastActivity + " .maxui-comment").length > 0) {
                lastActivity = jq("#" + lastActivity + " .maxui-comment:last").attr('id');
            }
        }
        var filter = {
            before: lastActivity
        };
        maxui.printActivitiesActivity(filter);
    };
    /** PG
     *    Loads news activities from max posted earlier than
     *    the oldest loaded activity
     **/
    jq.fn.loadNewsActivitiesActivity = function() {
        var maxui = this;
        maxui.printActivitiesActivity();
    };
    /**
     *    Renders the conversations list of the current user, defined in settings.username
     **/
    jq.fn.printPredictionsActivity = function(query, predictive_selector) {
        var maxui = this;
        var func_params = [];
        func_params.push(query);
        func_params.push(function(items) {
            maxui.formatPredictionsActivity(items, predictive_selector);
        });
        var userListRetriever = this.maxClient.getUsersList;
        userListRetriever.apply(this.maxClient, func_params);
    };
    /**
     *
     *
     **/
    jq.fn.formatPredictionsActivity = function(items, predictive_selector) {
        var maxui = this;
        // String to store the generated html pieces of each conversation item
        var predictions = '';
        // Iterate through all the conversations
        for (var i = 0; i < items.length; i++) {
            var prediction = items[i];
            if (prediction.username !== maxui.username) {
                var avatar_url = maxui.settings.avatarURLpattern.format(prediction.username);
                var params = {
                    username: prediction.username,
                    displayName: prediction.displayName,
                    avatarURL: avatar_url,
                    cssclass: 'maxui-prediction' + (i === 0 && ' selected' || '')
                };
                // Render the conversations template and append it at the end of the rendered covnersations
                predictions = predictions + maxui.templates.predictive.render(params);
            }
        }
        if (predictions === '') {
            predictions = '<li>' + maxui.settings.literals.no_match_found + '</li>';
        }
        jq(predictive_selector + ' ul').html(predictions);
        if (arguments.length > 2) {
            var callback = arguments[2];
            callback();
        }
    };
    /**
     *
     *
     **/
    jq.fn.canCommentActivityActivity = function(url) {
        var maxui = this;
        for (var i in maxui.settings.subscriptionsWrite) {
            var hash = maxui.settings.subscriptionsWrite[i].hash;
            if (hash === url) {
                return true;
            }
        }
        return false;
    };
    /**
     *    Renders the N activities passed in items on the timeline slot. This function is
     *    meant to be called as a callback of a call to a max webservice returning a list
     *    of activity objects
     *
     *    @param {String} items     a list of objects representing activities, returned by max
     *    @param {String} insertAt  were to prepend or append activities, 'beginning' or 'end
     *    @param {Function} (optional)  A function to call when all formatting is finished
     **/
    jq.fn.formatActivitiesActivity = function(items, insertAt) {
        var maxui = this;
        var activities = '';
        // Iterate through all the activities
        var images_to_render = [];
        for (var i = 0; i < items.length; i++) {
            var activity = items[i];
            // Take first context (if exists) to display in the 'published on' field
            // XXX TODO Build a coma-separated list of contexts ??
            var contexts = null;
            if (activity.hasOwnProperty('contexts')) {
                if (activity.contexts.length > 0) {
                    contexts = activity.contexts[0];
                }
            }
            // Take generator property (if exists) and set it only if it's different
            // from the application name defined in settings
            var generator = null;
            if (activity.hasOwnProperty('generator')) {
                if (activity.generator !== maxui.settings.generatorName) {
                    generator = activity.generator;
                }
            }
            // Prepare avatar image url depending on actor type
            var avatar_url = '';
            if (activity.actor.objectType === 'person') {
                avatar_url = maxui.settings.avatarURLpattern.format(activity.actor.username);
            } else if (activity.actor.objectType === 'context') {
                avatar_url = maxui.settings.contextAvatarURLpattern.format(activity.actor.hash);
            }
            // Take replies (if exists) and format to be included as a formatted
            // subobject ready for hogan
            var replies = [];
            var lastComment = '';
            if (activity.replies) {
                if (activity.replies.length > 0) {
                    for (var r = 0; r < activity.replies.length; r++) {
                        var comment = activity.replies[r];
                        var reply = {
                            id: comment.id,
                            actor: comment.actor,
                            date: maxui.utils.formatDate(comment.published, maxui.language),
                            text: maxui.utils.formatText(comment.content),
                            avatarURL: maxui.settings.avatarURLpattern.format(comment.actor.username),
                            canDeleteComment: comment.deletable,
                            literals: maxui.settings.literals
                        };
                        replies.push(reply);
                    }
                    lastComment = 'Comentat ' + replies[replies.length - 1].date;
                }
            }
            // Take all the latter properties and join them into an object
            // containing all the needed params to render the template
            _.defaults(activity.object, {
                filename: activity.id
            });
            var canCommentActivityActivity = maxui.settings.canwrite;
            if (activity.contexts) {
                canCommentActivityActivity = maxui.canCommentActivityActivity(activity.contexts[0].url);
            }
            var params = {
                id: activity.id,
                actor: activity.actor,
                auth: {
                    'token': maxui.settings.oAuthToken,
                    'username': maxui.settings.username
                },
                literals: maxui.settings.literals,
                date: maxui.utils.formatDate(activity.published, maxui.language),
                dateLastComment: lastComment,
                text: maxui.utils.formatText(activity.object.content),
                replies: replies,
                favorited: activity.favorited,
                likes: activity.likesCount ? activity.likesCount : 0,
                showLikesCount: maxui.currentSortOrder === 'likes',
                liked: activity.liked,
                flagged: activity.flagged,
                avatarURL: avatar_url,
                publishedIn: contexts,
                canDeleteActivity: activity.deletable,
                canFlagActivity: maxui.settings.canflag,
                via: generator,
                fileDownload: activity.object.objectType === 'file',
                filename: activity.object.filename,
                canViewComments: canCommentActivityActivity || activity.replies.length > 0,
                canWriteComment: canCommentActivityActivity
            };
            // Render the activities template and append it at the end of the rendered activities
            // partials is used to render each comment found in the activities
            var partials = {
                comment: maxui.templates.comment
            };
            activities = activities + maxui.templates.activity.render(params, partials);
            if (activity.object.objectType === 'image') {
                images_to_render.push(activity);
            }
        }
        // Prepare animation and insert activities at the top of activity stream
        if (insertAt === 'beggining') {
            // Load all the activities in a overflow-hidden div to calculate the height
            jq('#maxuiactivity-widget-container #maxui-preload .maxui-wrapper').prepend(activities);
            var ritems = jq('#maxuiactivity-widget-container #maxui-preload .maxui-wrapper .maxui-activity');
            var heightsum = 0;
            for (i = 0; i < ritems.length; i++) {
                heightsum += jq(ritems[i]).height() + 18;
            }
            // Move the hidden div to be hidden on top of the last activity and behind the main UI
            var currentPreloadHeight = jq('#maxuiactivity-widget-container #maxui-preload').height();
            jq('#maxuiactivity-widget-container #maxui-preload').height(heightsum - currentPreloadHeight);
            jq('#maxuiactivity-widget-container #maxui-preload').css({
                "margin-top": (heightsum - currentPreloadHeight) * -1
            });
            // Animate it to appear sliding on the bottom of the main UI
            jq('#maxuiactivity-widget-container #maxui-preload').animate({
                "margin-top": 0
            }, 200, function() {
                // When the animation ends, move the new activites to its native container
                jq('#maxuiactivity-widget-container #maxui-preload .maxui-wrapper').html("");
                jq('#maxuiactivity-widget-container #maxui-activities').prepend(activities);
                jq('#maxuiactivity-widget-container #maxui-preload').height(0);
            });
        }
        // Insert at the end
        else if (insertAt === 'end') {
            jq('#maxuiactivity-widget-container #maxui-activities').append(activities);
        }
        // Otherwise, replace everything
        else {
            jq('#maxuiactivity-widget-container #maxui-activities').html(activities);
        }
        // if Has a callback, execute it
        if (arguments.length > 2) {
            arguments[2].call();
        }
        _.each(images_to_render, function(activity, index, list) {
            maxui.maxClient.getMessageImage('/activities/{0}/image/thumb'.format(activity.id), function(encoded_image_data) {
                var imagetag = '<img class="maxui-embedded" alt="" src="data:image/png;base64,{0}" />'.format(encoded_image_data);
                jq('.maxui-activity#{0} .maxui-activity-message .maxui-body'.format(activity.id)).after(imagetag);
            });
        });
    };
    /**
     *    Renders the N comments passed in items on the timeline slot. This function is
     *    meant to be called as a callback of a call to a max webservice returning comments
     *    @param {String} items         a list of objects representing comments, returned by max
     *    @param {String} activity_id   id of the activity where comments belong to
     **/
    jq.fn.formatCommentActivity = function(items, activity_id) {
        // When receiving the list of activities from max
        // construct the object for Hogan
        // `activities `contain the list of activity objects
        // `formatedDate` contain a function maxui will be rendered inside the template
        //             to obtain the published date in a "human readable" way
        // `avatarURL` contain a function maxui will be rendered inside the template
        //             to obtain the avatar url for the activity's actor
        // Save reference to the maxui class, as inside below defined functions
        // the this variable will contain the activity item being processed
        var maxui = this;
        var comments = '';
        for (var i = 0; i < items.length; i++) {
            var comment = items[i];
            var params = {
                literals: maxui.settings.literals,
                id: comment.id,
                actor: comment.actor,
                date: maxui.utils.formatDate(comment.published, maxui.language),
                text: maxui.utils.formatText(comment.content),
                avatarURL: maxui.settings.avatarURLpattern.format(comment.actor.username),
                canDeleteComment: comment.deletable
            };
            // Render the comment template and append it at the end of the rendered comments
            comments = comments + maxui.templates.comment.render(params);
        }
        // Insert new comments by replacing previous comments with all comments
        jq('.maxui-activity#' + activity_id + ' .maxui-commentsbox').html(comments);
        // Update comment count
        var comment_count = jq('.maxui-activity#' + activity_id + ' .maxui-commentaction strong');
        jq(comment_count).text(parseInt(jq(comment_count).text(), 10) + 1);
    };
    /**
     *    Renders the postbox
     **/
    jq.fn.renderPostboxActivity = function() {
        var maxui = this;
        // Render the postbox UI if user has permission
        var showCT = maxui.settings.UISection === 'conversations';
        var toggleCT = maxui.settings.disableConversations === false && !showCT;
        var params = {
            avatar: maxui.settings.avatarURLpattern.format(maxui.settings.username),
            allowPosting: maxui.settings.canwrite,
            buttonLiteral: maxui.settings.literals.new_activity_post,
            textLiteral: maxui.settings.literals.new_activity_text,
            literals: maxui.settings.literals,
            showConversationsToggle: toggleCT ? 'display:block;' : 'display:none;',
            showSubscriptionList: maxui.settings.showSubscriptionList && maxui.settings.subscriptionsWrite.length > 0,
            subscriptionList: maxui.settings.subscriptionsWrite
        };
        var postbox = maxui.templates.postBox.render(params);
        var $postbox = jq('#maxuiactivity-widget-container #maxui-newactivity');
        $postbox.html(postbox);
    };
    /**
     *    Renders the timeline of the current user, defined in settings.username
     **/
    jq.fn.printActivitiesActivity = function(ufilters) {
        // save a reference to the container object to be able to access it
        // from callbacks defined in inner levels
        var maxui = this;
        var func_params = [];
        var insert_at = 'replace';
        // Get current defined filters and update with custom
        var filters = maxui.getFiltersActivity().filters;
        jq.extend(filters, ufilters);
        if (filters.before) {
            insert_at = 'end';
        }
        if (filters.after) {
            insert_at = 'beggining';
        }
        if (!filters.sortBy) {
            if (jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-sort-action.maxui-most-valued').hasClass('active')) {
                filters.sortBy = 'likes';
            } else if (jq('#maxuiactivity-widget-container #maxui-activity-sort .maxui-sort-action.maxui-flagged').hasClass('active')) {
                filters.sortBy = 'flagged';
            } else {
                filters.sortBy = maxui.settings.activitySortOrder;
            }
        }
        maxui.currentSortOrder = filters.sortBy;
        var activityRetriever = null;
        if (maxui.settings.activitySource === 'timeline') {
            activityRetriever = this.maxClient.getUserTimeline;
            func_params.push(maxui.settings.username);
        } else if (maxui.settings.activitySource === 'activities') {
            activityRetriever = this.maxClient.getActivities;
            var options = {
                context: maxui.settings.readContextHash,
                tags: maxui.settings.contextTagsFilter
            };
            func_params.push(options);
        }
        if (arguments.length > 1) {
            var callback = arguments[1];
            func_params.push(function(items) {
                // Determine write permission, granted by default if we don't find a restriction
                maxui.settings.canwrite = true;
                // If we don't have a context, we're in timeline, so we can write
                if (maxui.settings.activitySource === 'activities') {
                    maxui.maxClient.getContext(maxui.settings.readContextHash, function(context) {
                        // Add read context if user is not subscribed to it
                        var subscriptions = maxui.settings.subscriptions;
                        if (!subscriptions[context.hash]) {
                            subscriptions[context.hash] = {};
                            subscriptions[context.hash].permissions = {};
                            // Check only for public defaults, as any other permission would require
                            // a susbcription, that we already checked that doesn't exists
                            subscriptions[context.hash].permissions.read = context.permissions.read === 'public';
                            subscriptions[context.hash].permissions.write = context.permissions.write === 'public';
                        }
                        // Iterate through all the defined write contexts to check for write permissions on
                        // the current user
                        for (var wc = 0; wc < maxui.settings.writeContexts.length; wc++) {
                            var write_context = maxui.settings.writeContextsHashes[wc];
                            if (subscriptions[write_context].permissions) {
                                if (subscriptions[write_context].permissions.write !== true) {
                                    maxui.settings.canwrite = false;
                                }
                                if (subscriptions[write_context].permissions.flag === true) {
                                    maxui.settings.canflag = true;
                                } else {
                                    maxui.settings.canflag = false;
                                }
                            } else {
                                maxui.settings.canwrite = false;
                                maxui.settings.canflag = false;
                            }
                        }
                        maxui.renderPostboxActivity();
                        // format the result items as activities
                        maxui.formatActivitiesActivity(items, insert_at, callback);
                    });
                } else {
                    maxui.renderPostboxActivity(items, insert_at, callback);
                    // format the result items as activities
                    maxui.formatActivitiesActivity(items, insert_at, callback);
                }
            });
        } else {
            func_params.push(function(items) {
                maxui.formatActivitiesActivity(items, insert_at);
            });
        }
        // if passed as param, assume an object with search filtering params
        // one or all of [limit, before, after, hashtag]
        func_params.push(filters);
        activityRetriever.apply(this.maxClient, func_params);
    };
    /**
     *    Renders the timeline of the current user, defined in settings.username
     **/
    jq.fn.printCommentsForActivityActivity = function(activity_id) {
        var maxui = this;
        var func_params = [];
        func_params.push(activity_id);
        func_params.push(function(data) {
            maxui.formatCommentActivity(data, activity_id);
        });
        this.maxClient.getCommentsForActivity.apply(this.maxClient, func_params);
    };
    jq.maxui = function() {};
    jq.maxui.settings = function() {
        return this.settings;
    };
}(jQuery));
