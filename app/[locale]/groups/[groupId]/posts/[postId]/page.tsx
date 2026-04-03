import PostReadScreen from '@/components/posts/PostReadScreen';

interface ReadGroupPostPageProps {
  params: Promise<{groupId: string; postId: string}>;
}

export default async function ReadGroupPostPage({params}: ReadGroupPostPageProps) {
  const {groupId, postId} = await params;
  return <PostReadScreen scope="group" groupId={groupId} postId={postId} />;
}

