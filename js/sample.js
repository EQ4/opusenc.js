/*!
 * Copyright © 2014 Rainer Rillke <lastname>@wikipedia.de
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

/*global tags: false, console: false*/
/*jslint vars: false,  white: false */
/*jshint onevar: false, white: false, laxbreak: true, worker: true */

( function( global ) {
	'use strict';

	var $button, $fileInput, $workerDlg, $workerProgress, $console, $errors, $info, worker;
	var storedFiles = {},
		outData = {},
		$cmd = $( '#oe-cmd-options' ),
		availableTags = $.map( tags, function( tagDetails, tag ) {
			var ret = [ '--' + tag ];
			if ( tagDetails.short ) {
				ret.push( '-' + tagDetails.short );
			}
			return ret;
		} );

	$button = $( '#oe-run-button' );
	$fileInput = $( '#oe-run-file' );
	$workerDlg = $( '<div>' );
	$workerProgress = $( '<progress style="display: inline-block; text-align: center; width: 100%;" value="0" max="100">Your browser does not support this tool. Upgrade to a modern browser, please.</progress>' )
		.appendTo( $workerDlg );
	$console = $( '<div style="overflow: auto; height: 300px; border: 1px solid grey; padding: 2px; resize: both; white-space: pre-wrap;" class="oe-console"></div>' )
		.appendTo( $workerDlg );
	$errors = $( '<pre>' )
		.addClass( 'oe-console-errors' );
	$info = $( '<pre>' )
		.addClass( 'oe-console-info' );

	function encode() {
		var f = $fileInput[ 0 ].files[ 0 ],
			fr = new FileReader();

		$fileInput.attr( 'disabled', 'disabled' );

		fr.addEventListener( 'loadend', function() {
			var pastArg, args;

			$workerDlg.dialog( {
				'modal': true,
				'closeOnEscape': false,
				'dialogClass': 'oe-progress-dialog',
				'width': 660,
				'open': function() {
					$( this )
						.dialog( 'widget' )
						.find( '.ui-dialog-titlebar' )
						.hide();
				}
			} );

			args = $cmd.tagit( 'assignedTags' );

			// Collect infos about files we want to get
			// later out of the encoder
			$.each( args, function( i, arg ) {
				var reSwitch = /^\-\-/;

				if ( pastArg ) {
					outData[ arg ] = pastArg;
					return pastArg = undefined;
				}
				if ( !reSwitch.test( arg ) ) {
					return;
				}
				arg = arg.replace( reSwitch, '' );
				pastArg = tags[ arg ].outfile;
			} );

			storedFiles[ f.name ] = new Uint8Array( fr.result );
			args.push( f.name );
			args.push( 'encoded.opus' );
			outData[ 'encoded.opus' ] = {
				'MIME': 'audio/ogg'
			};

			$info
				.clone()
				.text( 'niceguy@rillke.com$ opusenc "' + args.join( '" "' ) + '"' )
				.appendTo( $console );

			$info
				.clone()
				.text( 'loading web worker scripts (1.2 MiB) ...' )
				.appendTo( $console );

			worker.postMessage( {
				command: 'encode',
				importRoot: '',
				args: args,
				outData: outData,
				fileData: storedFiles
			} );
		} );
		fr.readAsArrayBuffer( f );
	}

	function validateTag( e, ui ) {
		var tagInfo;

		if ( ui.duringInitialization ) return;
		tagInfo = tags[ ui.tagLabel.replace( '--', '' ) ];
		if ( !tagInfo || !tagInfo.fmt ) return;
		var $dlg = $( '<form>' ),
			$submit = $( '<input type="submit" value="Submit" />' )
				.css( {
					'position': 'absolute',
					'z-index': '-1',
					'top': 0,
					'left': 0
				} )
				.fadeTo( 0, 0 )
				.appendTo( $dlg ),
			$pre = $( '<pre>' )
				.css( 'width', '90%' )
				.text( tagInfo.desc )
				.appendTo( $dlg ),
			$input = $( '<input>' )
				.attr( {
					'pattern': tagInfo.regexp.toString()
						.replace( /^\/(.+)\/$/, '$1' ),
					'required': 'required',
					'title': tagInfo.constraint || tagInfo.desc,
					'value': tagInfo.fmt,
					'name': 'foobar'
				} )
				.appendTo( $dlg ),
			$fileParamInput = $( '<input id="files" name="file" style="width:98%" type="file" required="required" />' );

		if ( tagInfo.infile ) {
			$dlg.append( $fileParamInput.clone()
				.attr( 'accept', tagInfo.infile.accept ) );
		}
		$dlg.dialog( {
			'title': 'Options for ' + ui.tagLabel,
			'modal': true,
			'width': 500,
			'autoOpen': false,
			'buttons': {
				'Okay': function() {
					if ( $input[ 0 ].checkValidity() ) {
						$dlg.submit();
					} else {
						$( '<div>' )
							.addClass( 'ui-state-highlight' )
							.text( tagInfo.constraint || tagInfo.desc )
							.insertAfter( $input );
						$input.focus()
							.select();
					}
				}
			},
			'open': function() {
				$input.focus()
					.select();
			},
			'close': function() {
				$dlg.remove();
			}
		} );
		$dlg.submit( function( e ) {
			var f, fr, fileName;

			// Prevent submitting data to non-existant server
			e.preventDefault();

			// Disable all inputs to prevent interaction
			// after submitting data e.g. during reading the file
			$dlg.find( 'input' )
				.attr( 'disabled', 'disabled' );
			$dlg.dialog( 'widget' )
				.find( '.ui-dialog-titlebar,.ui-dialog-buttonpane' )
				.hide();

			$cmd.tagit( 'createTag', $input.val() );
			if ( tagInfo.infile ) {
				f = $fileParamInput[ 0 ].files[ 0 ];
				fr = new FileReader();

				fileName = $input.val();
				if ( /\|/.test( fileName ) ) {
					fileName = fileName.replace( /(?:\|.+?)*\|(.+)$/, '$1' );
				}

				fr.addEventListener( 'loadend', function() {
					storedFiles[ fileName ] = new Uint8Array( fr.result );
					$dlg.remove();
					$cmd.focus()
						.next()
						.find( '.tagit-new input' )
						.focus();
				} );
				fr.readAsArrayBuffer( f );
			} else {
				$dlg.remove();
				$cmd.focus()
					.next()
					.find( '.tagit-new input' )
					.focus();
			}
		} );
		setTimeout( function() {
			$dlg.dialog( 'open' );
		}, 5 );
	}

	$cmd.tagit( {
		placeholderText: 'Type `-´ for suggestions',
		availableTags: availableTags,
		removeConfirmation: true,
		allowDuplicates: true,
		beforeTagAdded: validateTag
	} );

	try {
		worker = new Worker( 'worker/EmsWorkerProxy.js' );
	} catch ( ex ) {
		console.error( ex );
	}

	$button
		.button( {
			icons: {
				primary: 'ui-icon-arrowreturnthick-1-e'
			}
		} );

	worker.onmessage = function( e ) {
		/*jshint forin:false */
		var vals, fileName;

		if ( !e.data ) {
			return;
		}
		switch ( e.data.reply ) {
			case 'progress':
				vals = e.data.values;
				if ( vals[ 1 ] ) {
					$workerProgress.val( vals[ 0 ] / vals[ 1 ] * 100 );
				}
				break;
			case 'done':
				$workerProgress.val( 100 );
				for ( fileName in e.data.values ) {
					if ( !e.data.values.hasOwnProperty( fileName ) ) {
						return;
					}
					$( '<a>' )
						.text( fileName )
						.prop( 'href', window.URL.createObjectURL( e.data.values[fileName].blob ) )
						.attr( 'download', fileName )
						.attr( 'style', 'background: url("images/icon_download.png") no-repeat scroll left center transparent; padding-left: 28px;' )
						.insertAfter( $workerProgress )
						.click();
					$workerProgress.append( ' ' );
				}
				break;
			case 'log':
				var lines = $.trim( e.data.values[ 0 ] ).replace( /\r/g, '\n' ),
					$lines;

				lines = lines.split( '\n' );
				$.each( lines, function( i, l ) {
					lines[i] = l.replace( /\s*$/, '' );
				} );
				lines = lines.join( '\n' ).replace( /\n+/g, '\n' );
				$lines = $info.clone().text( lines ).appendTo( $console );
				$console.clearQueue().animate({ scrollTop: $console.scrollTop() + $lines.position().top }, 800);
				break;
			case 'err':
				if ( !$errors.hasParent ) {
					$errors.hasParent = true;
					$errors.appendTo( $console );
				}
				break;
		}
	};

	function bindEvent( i, evt ) {
		$fileInput.on( evt, function() {
			$button.triggerHandler( evt );
		} );
	}

	$fileInput.change( encode );
	$.each( [ 'focus', 'blur', 'mouseenter', 'mouseout', 'mousedown', 'mouseup' ], bindEvent );

	// Forward focus from command line fake console to input
	$( '#oe-command-line-options .oe-console' )
		.click( function() {
			$( '.tagit-new input' )
				.focus();
		} );

   // No runtime error so far, so hide the warning
	$( '.oe-js-warn' ).hide();
}( window ) );