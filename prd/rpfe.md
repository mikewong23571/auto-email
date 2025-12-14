Executive Summary

A lightweight Email Management System (EMS) will process inbound emails routed through Cloudflare

Email   Workers.   The   worker   reads   the   raw   RFC 822   email   ( message.raw )   and   uses   the  postal‑mime

library to parse it into a structured object. This parsed object becomes the system boundary between the

email   routing   layer   and   the   backend.   The   boundary   exposes   headers,   sender/recipient   metadata,

plain‑text and HTML bodies and an array of attachments; each attachment carries metadata (filename,

MIME type, disposition, related flag, content ID, optional description and method) and the binary content

as an  ArrayBuffer  or string depending on the configuration

1

2

. The EMS must persist this data in a

REST‑friendly JSON model, upload attachment binaries to object storage (e.g., Cloudflare R2) and store

only the resulting links. The integration contract therefore centres on postal‑mime’s   parse()  call, its

input types, options (such as  attachmentEncoding ) and the exact shape of the returned Email object

1

.

Non‑goals include the internal parsing algorithm or database UI details; only the external data model and

the interaction contract are in scope.

System Context and Intent

The EMS is designed for internal testing/QA. Incoming emails are routed via Cloudflare Email Workers

and passed to a worker function. Cloudflare provides basic envelope metadata (via   message.headers )

but not the full email content. The worker reads   message.raw , which is a stream of the full RFC 822

message

3

, and uses postal‑mime to parse it into a structured object. The system then:

1.

Parses the email – Calls  PostalMime.parse(message.raw[, options]) , producing an Email object

with typed fields for headers, addresses, subject, message bodies and attachments

1

.

2.

Uploads attachments – Iterates over the  attachments  array, storing each  content  (an

ArrayBuffer  by default) to R2 storage and replacing it with a public URL. Only metadata and

URLs are stored in the EMS database.

3.

Stores metadata – Serialises the remainder of the Email object into JSON and sends it to the

backend (PocketBase/SQLite) via REST.

The   intent   is   to   establish   a   reliable   contract   for   this   boundary.   The   backend   should   not   need   to

understand   MIME;   instead   it   consumes   clean   JSON   produced   by   postal‑mime   and   references   to

attachments stored externally.

Term Definition and Boundary (In/Out)

Postal‑mime  refers to a JavaScript/TypeScript email parser library developed by  Andris Reinman  and

the  Postal   Systems  team.   It   runs   in   browser   environments,   web   workers   and   serverless   platforms

(including   Cloudflare   Workers)   and   parses   raw   RFC 822   messages   into   structured   JavaScript   objects

containing headers, addresses, message bodies and attachments

4

. The library has an AGPL‑licensed

version on NPM and an MIT‑licensed version available to subscribers, but both share the same API and

data   model

5

.   This   definition   is   supported   by   the   official   GitHub   README

1

  and   TypeScript

definitions

2

. Alternative sources (blog posts or community discussions) describe the same behaviour

6

, so no conflicting definitions were found.

1

Inside the boundary:

•

The input to  PostalMime.parse()  – any raw email string,  ArrayBuffer ,  Uint8Array ,  Blob ,

Buffer  or  ReadableStream

7

. The EMS must supply a supported type (e.g., Cloudflare’s

message.raw ).

•

The configuration options passed to  parse()  – e.g.,  attachmentEncoding ,  rfc822Attachments ,

forceRfc822Attachments ,  maxNestingDepth  and  maxHeadersSize

8

9

.

•

The returned Email object – including  headers ,  from ,  to ,  subject , message bodies and

attachments

1

.

•

Attachment handling – attachments’ metadata and binary content representation

( ArrayBuffer ,  Uint8Array  or encoded string)

2

.

Outside the boundary:

•

Internal parsing algorithms or MIME decoding logic (these remain within postal‑mime).

•

The EMS’s persistence layer (database schemas, UI forms) except for how it stores the parsed

fields.

•

UI rendering or representation of emails; the boundary ends once the structured data is delivered

to the backend.

Boundary Interaction Model

Inputs:

•

Raw email – Provided as  message.raw  from Cloudflare Email Worker. Acceptable input types

include a string,  ArrayBuffer ,  Uint8Array ,  Blob ,  Buffer  or  ReadableStream

7

.

•

Options (optional) – A  PostalMimeOptions  object with fields:  attachmentEncoding  ( "base64" ,

"utf8"  or  "arraybuffer" , default  arraybuffer ),  rfc822Attachments  (boolean),

forceRfc822Attachments  (boolean),  maxNestingDepth  and  maxHeadersSize

8

9

. Using

attachmentEncoding  influences how attachments’  content  is returned;  base64  or  utf8

returns a string, while  arraybuffer  returns binary data

10

.

Outputs:

•

A Promise that resolves to an Email object with the following properties

1

11

:

•

headers : ordered array of header objects ( key  – lowercase header name,  originalKey  –

original case,  value  – raw header value).

•

from ,  sender :  Address  objects (may be a single Mailbox or an address group with  group

array).  Mailbox  has  name  and  address  fields

12

.

•

deliveredTo ,  returnPath : single email address strings.

•

to ,  cc ,  bcc ,  replyTo : arrays of  Address  objects.

•

subject ,  messageId ,  inReplyTo ,  references : strings extracted from corresponding headers.

•

date : ISO‑8601 formatted date (if parsing succeeds) or the original string

13

.

•

html : HTML body of the email;  text : plain‑text body

13

.

•

attachments : array of Attachment objects. Each attachment includes  filename ,  mimeType ,

disposition  ( attachment ,  inline , or  null ), optional  related  (true for inline images),

optional  description , optional  contentId , optional  method ,  content  (binary or string) and

optional  encoding  ( base64  or  utf8 )

2

.

2

Major Flow and Lifecycle:

1.

Receive Raw Email – Cloudflare invokes the worker with  message . The EMS reads  message.raw ,

which is a ReadableStream representing the RFC 822 message

3

.

2.

Parse – Call  PostalMime.parse(message.raw, options) . Postal‑mime parses headers, decodes

MIME‑encoded words, handles multipart bodies and attachments, and enforces nesting and

header size limits. If  attachmentEncoding  is not specified, attachments’  content  is returned as

an  ArrayBuffer ; specifying  utf8  or  base64  returns a string

10

.

3.

Process Attachments – Iterate through  email.attachments . For each attachment, determine if

encoding  is present; treat  content  as a string for encoded attachments or an  ArrayBuffer /

Uint8Array  for binary ones

2

. Upload the binary to object storage (R2) and replace the

content  field with a URL. Preserve metadata like  filename ,  mimeType ,  disposition ,  related ,

description ,  contentId  and  method .

4.

Construct JSON – Combine the top‑level fields (headers, address arrays, subject, etc.) with the

modified attachments array. Convert  ArrayBuffer / Uint8Array  fields to base64 strings if

necessary for JSON serialization.

5.

Persist and Respond – Send the JSON to the backend via REST. If postal‑mime throws an error

(e.g., invalid input or security limit exceeded), return an error response or retry depending on EMS

policy.

Dependencies:  The boundary depends on postal‑mime (version ≥ 2.6.x) and Cloudflare Email Worker

runtime. It does not call external services or rely on stateful network connections.

Lifecycle Considerations: Each parser instance is single‑use: the  parse()  method must only be called

once   per   PostalMime   instance【427218936480027†L125‑L124】;   create   a   new   instance   for   each

message. The system should handle asynchronous parsing using  await .

Engineering Contract (Textual Spec)

Aspect

Specification

Interface

Use  PostalMime.parse(rawEmail, options?)  (static or instance method) to

convert a raw RFC 822 message into a structured  Email  object

1

. The EMS

must supply a raw email as a  string ,  ArrayBuffer ,  Uint8Array ,  Blob ,

Buffer  or  ReadableStream

7

.

The returned  Email  object has the following fields:  headers: Header[]  (each

header has  key ,  originalKey ,  value ),  from?: Address ,  sender?: Address ,
replyTo?: Address[] ,  deliveredTo?: string ,  returnPath?: string ,  to?:

Address[] ,  cc?: Address[] ,  bcc?: Address[] ,  subject?: string ,

messageId?: string ,  inReplyTo?: string ,  references?: string ,  date?:

string (ISO‑8601 or raw) ,  html?: string ,  text?: string ,  attachments:

Data Model

Attachment[]

1

11

. An  Address  is either a  Mailbox  ( { name: string;

address: string; group?: undefined } ) or a group ( { name: string; group:

Mailbox[] } )

12

. An  Attachment  includes  filename: string | null ,

mimeType: string ,  disposition: "attachment" | "inline" | null , optional

related , optional  description , optional  contentId , optional  method ,

content: ArrayBuffer | Uint8Array | string , and optional

encoding: "base64" | "utf8"

2

.

3

Aspect

Specification

Postal‑mime performs no authentication; the EMS is responsible for authorizing

inbound emails and securing the storage of attachments. Trust assumptions: the

AuthN/AuthZ

input  rawEmail  must come from Cloudflare’s verified email routing;

attachments are untrusted data and must be sanitized by downstream

components.

parse()  returns a Promise that rejects on invalid input (e.g., non‑RFC 822

message) or if security limits ( maxNestingDepth ,  maxHeadersSize ) are exceeded

8

. The EMS should catch exceptions and respond with appropriate HTTP

Failure Modes

& Recovery

errors. Parsing is synchronous on CPU; large emails may cause processing delays.

Attachments’  content  may be  Uint8Array , which JSON serialization does not

support directly—attempting to log it as JSON will result in empty  {}

14

; the

EMS must convert binary to base64 before logging or persisting. Idempotency:

each call to  parse()  produces a deterministic result for the given input; there is

no stateful side effect.

Ordering /
Consistency

The  headers  array preserves the original order of headers as they appear in the

email

15

. Address arrays ( to ,  cc ,  bcc ) are in the order found in the headers.

The EMS must not reorder attachments or headers when persisting unless

explicitly required.

Postal‑mime itself imposes no rate limits; throughput is constrained by

Rate Limits /

Cloudflare worker execution time limits (~50 ms CPU per request) and memory

Quotas

usage. The EMS should implement backpressure or queueing if high email

volume is expected.

As of version 2.6.x (Nov 2025), the Email object and options are as described

8

Versioning /

Evolution

1

. Future versions may add fields (e.g.,  description ,  method ) or change

defaults. To ensure compatibility, the EMS should pin a specific postal‑mime

version and validate fields at runtime.

Log at least the  messageId ,  from.address ,  to.addresses ,  subject  and any

attachment filenames. Avoid logging raw attachment content. Errors thrown by

Observability

postal‑mime should include stack traces; these should be captured. When

uploading attachments, log the resulting URL and original filename for

traceability.

Postal‑mime enforces limits on nesting depth and header size to prevent

Security

resource exhaustion

8

. The EMS must treat all parsed content as untrusted;

Considerations

attachments and message bodies may contain malicious content (e.g., script

tags). Sanitisation should occur when rendering HTML or storing attachments.

Evidence Register

Claim

Source

Tier

Notes

Postal‑mime runs in browsers, Web Workers

and serverless functions and parses raw

RFC 822 emails into structured objects

Official GitHub

README

4

Confirms supported

1

environments and

high‑level purpose.

4

Claim

Source

Tier

Notes

The library outputs a structured  Email  object

with headers, address fields, subject,

GitHub README

messageId, references, date, html, text and

1

attachments

Each header has  key  (lower‑case),  value

TypeScript

(raw) and  originalKey  (original casing)

definitions

16

Address  can be a  Mailbox  (name and

address) or a group of  Mailbox  objects

TypeScript

definitions

12

Attachment objects include  filename ,

mimeType ,  disposition , optional  related ,

optional  description , optional  contentId ,

optional  method ,  content  (ArrayBuffer/

Uint8Array/string) and optional  encoding

TypeScript

definitions

2

Acceptable input types to  parse()  are string,

ArrayBuffer, Uint8Array, Blob, Buffer or

ReadableStream

TypeScript
definitions

7

PostalMimeOptions  allows configuring

rfc822Attachments ,

forceRfc822Attachments ,

attachmentEncoding  (base64/utf8/

arraybuffer),  maxNestingDepth , and

maxHeadersSize

By default attachments are returned as

ArrayBuffer ; setting  attachmentEncoding  to

“utf8” or “base64” returns string content

TypeScript

definitions

9

and CSS Script

article

8

EmailEngine

blog

6

 and

CSS Script

article

10

In Cloudflare Email Workers,  message.raw  is a

readable stream containing the raw email and

must be parsed manually for content

EmailEngine

blog

3

17

The  headers  array preserves the original

order of email headers

Skypack

README

18

Attempting to JSON‑stringify an attachment's

Cloudflare

Uint8Array  returns  {}  because binary data

community post

cannot be stringified

14

Each PostalMime parser instance is single‑use;

Skypack

parse()  must be called once per instance

README

19

Postal‑mime includes built‑in security limits

on nesting depth and header size

CSS Script

article

8

1

1

1

1

Provides list of fields

returned by  parse() .

Defines the  Header

type.

Shows the union type

for addresses.

Provides the exact

shape of attachments.

1

Defines  RawEmail .

1

2

2

2

3

2

2

Documents available

options.

Confirms default

behaviour and

configuration for

attachment encoding.

Shows that the worker

exposes only

envelope metadata

and a raw stream.

Confirms header

ordering.

Suggests conversion

to base64 before

logging or persisting.

Implementation detail

important for

lifecycle.

Provides guidance on

internal limits to

prevent abuse.

5

Open Questions, Unknowns, and Recommended

Next Verifications

1.

Attachment  description  and  method  semantics – The TypeScript definitions include optional

description  and  method  fields on the  Attachment  type

2

, but the README does not describe

them. It is unclear when these fields are populated or what values  method  can take. Next step:

Inspect postal‑mime’s source code or open issues to understand these fields; confirm whether

the MIT version differs.

2.

Large email performance – The EMS must handle potentially large emails and attachments

within Cloudflare Workers’ CPU and memory limits. The library’s default security limits can be

configured via  maxNestingDepth  and  maxHeadersSize

8

, but recommended values for high

throughput are not documented. Next step: Benchmark parsing times and memory usage with

realistic sample emails; adjust worker execution parameters accordingly.

3.

Internationalisation and charset handling – Postal‑mime claims to handle charsets and MIME

encoded words

20

. However, guidelines on custom charsets or error handling are not detailed.

Next step: Test parsing of emails with non‑UTF‑8 charsets, unusual encodings or invalid MIME

structures; verify that the returned  name  and  text  fields are properly decoded.

4.

Version stability – The report assumes version ≥ 2.6.x (Nov 2025). Future releases may change

defaults or data structures. Next step: Subscribe to postal‑mime’s changelog, pin the package

version and include automated regression tests to detect schema changes.

5.

AGPL vs MIT licensing – The AGPL version on NPM uses a copyleft licence, while a commercially

supported MIT version exists

5

. The EMS team must ensure licence compliance. Next step:

Confirm which licence the project uses and whether internal testing/QA distribution requires the

MIT version.

Research Plan (What You Did and Why)

Initial Sources and Prioritization: Based on the provided context, the primary objective was to define

postal‑mime’s output structure and integration behaviour. Tier‑1 sources (official documentation and

source code) were prioritised. The GitHub repository’s README provided high‑level features and usage

guidelines

4

1

, while the raw TypeScript definitions offered authoritative type information for the

Email   and   Attachment   objects

21

.   The   Skypack   copy   of   the   README   was   consulted   for   additional

confirmation   and   details   about   header   ordering   and   single‑use   instances【427218936480027†L125‑

L124】.

Additional Sources: To verify default behaviours and configuration options, a CSS Script article and the

EmailEngine blog post authored by the library maintainer were consulted. These Tier‑2 sources explained

how attachments are returned as ArrayBuffers by default and how to use the  attachmentEncoding  option

10

6

. A Cloudflare community post highlighted a practical issue with JSON‑stringifying attachments

and reinforced the need to convert binary data

14

.

Validation Approach: Each critical claim was cross‑checked across multiple sources. Where the README

listed the Email object’s fields, the TypeScript definitions were used to confirm field names and types

(ensuring   no   omissions).   Configuration   options   were   validated   through   both   the   definitions   and

explanatory   articles.   For   behaviours   like   default   attachment   encoding,   at   least   one   primary   and   one

secondary   source   were   cited.   If   conflicting   information   had   arisen,   it   would   have   been   noted   in   the

evidence register with a credibility assessment.

6

Handling Ambiguity and Conflicts:  No major conflicts were found. Ambiguities such as unexplained

description  and  method  fields in attachments were documented as open questions. The AGPL vs MIT

licensing difference was noted, but since it does not change the data model, it was recorded as a legal

consideration. All unknowns and unverified assumptions were clearly marked.

Unexecuted   Steps:  Direct   testing   of   the   library   was   not   performed   due   to   environment   constraints.

Future work should include running postal‑mime in a worker environment with sample emails to validate

the described behaviour and to benchmark performance. Additionally, security review of the library’s

parsing logic would be prudent before production use.

system_context: A lightweight Email Management System (EMS) designed for internal testing/QA. The

architecture involves a Cloudflare Worker receiving raw emails, using 'postal‑mime' to clean/parse them,

uploading attachments to R2 (storing only links), and sending the clean JSON payload to a backend (e.g.,

PocketBase/SQLite) via REST API. The system focuses on single‑responsibility components. system_goal:

defining the system's data model and integration contract based strictly on the library's output structure

boundary_term:   postal‑mime   term_category:   Library/Software   Component   known_context:   Used   in

Cloudflare Workers; parses raw MIME (multipart/mixed, base64, charsets) into JSON; outputs fields like

from, to, subject, text, html, attachments; attachments are ArrayBuffers in memory which the system will

swap for R2 links. non_goals: Implementation details of the database internals or frontend UI beyond the

schema definition constraints: RESTful architecture, strict engineering format, single document output

1

4

13

GitHub ‑ postalsys/postal‑mime: Email parser for browser and serverless environments

https://github.com/postalsys/postal‑mime

2

7

9

11

12

16

21

raw.githubusercontent.com

https://raw.githubusercontent.com/postalsys/postal‑mime/master/postal‑mime.d.ts

3

6

17

How to parse emails with Cloudflare Email Workers?

https://blog.emailengine.app/how‑to‑parse‑emails‑with‑cloudflare‑email‑workers/

5

15

18

19

npm:postal‑mime | Skypack

https://www.skypack.dev/view/postal‑mime

8

10

20

Parse Emails in Browser & Serverless: postal‑mime | CSS Script

https://www.cssscript.com/parse‑email‑postal‑mime/

14

Email workers access to attachments, body or raw message ‑ Application Performance / Email Routing

‑ Cloudflare Community

https://community.cloudflare.com/t/email‑workers‑access‑to‑attachments‑body‑or‑raw‑message/452913

7


