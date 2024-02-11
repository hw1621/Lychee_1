import { OAuth2RequestError } from 'arctic';
import { generateId } from 'lucia';
import { cookies } from 'next/headers';
import { lichess, lucia } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { LichessUser } from '@/types/lichess-api';

export async function GET(request: Request): Promise<Response> {
  await dbConnect();

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies().get('lichess_oauth_state')?.value ?? null;
  const codeVerifier = cookies().get('lichess_oauth_code_validation')?.value;

  if (
    !code ||
    !state ||
    !storedState ||
    state !== storedState ||
    !codeVerifier
  ) {
    return new Response(
      "code or state don't match stored to those stored in cookies",
      {
        status: 400,
      }
    );
  }

  try {
    const tokens = await lichess.validateAuthorizationCode(code, codeVerifier);
    const lichessUserResponse = await fetch('https://lichess.org/api/account', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    const lichessUser: LichessUser = await lichessUserResponse.json();
    console.log('lichessUser', lichessUser);

    cookies().set('token', tokens.accessToken, {
      sameSite: 'lax',
      secure: true,
    });

    const existingUser = await User.findOne({ username: lichessUser.id });

    if (existingUser) {
      const session = await lucia.createSession(existingUser.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
      );
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/',
        },
      });
    }

    const userId = generateId(15);
    const name = `${lichessUser.profile?.firstName ?? ''}${lichessUser.profile?.lastName ? ' ' + lichessUser.profile.lastName : ''}`;

    // await db.insert(users).values({
    //     id: userId,
    //     rating: lichessUser.perfs.blitz.rating,
    //     username: lichessUser.id,
    //     name,
    // });

    await User.create({
      _id: userId,
      username: lichessUser.id,
    });

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
      },
    });
  } catch (e) {
    if (
      e instanceof OAuth2RequestError &&
      e.message === 'bad_verification_code'
    ) {
      return new Response(JSON.stringify(e), {
        status: 400,
      });
    }
    return new Response(null, {
      status: 500,
    });
  }
}